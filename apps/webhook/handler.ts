import {createHmac} from "node:crypto";

//checking signature (incoming webhook request which has rawbody and secret -> Sha256'ed to create signature), checking it with our secret and rawbody to confirm that the request is from github and not from some malicious source
const verifyWebhookSignature = (rawBody: string, signature: string, secret: string): boolean => {
    const expectedSignature = `sha256=${createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex")
    }`;

    return signature === expectedSignature;
};

//if repoId doesnt match the allowed repository scope with which app is given permission to, then reject webhook event
const isRepositoryAllowed = (repositoryId: number, selectedRepositoryIds: number[]): boolean => {
    return selectedRepositoryIds.includes(repositoryId);
}

//type is typescript object compile time shape definition, using it to normalise the webhook payloads we get
//exporting it seperately and not with verifyWebhookSignature as it is a ts type not a runtime js function/value
export type NormalizedWebhookEvent = {
    deliveryId: string;
    eventName: "pull_request" | "check_suite" | "check_run" | "installation" | "installation_repositories";
    action: string;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    receivedAt: string;
    //pull request is optional as not every event is pull_request, can get installation event for eg which doesn't have pull request details
    pullRequest?: {
        //pr number 
        number: number;
        //latest commit of pr branch we are mergin
        headSha: string;
        //commit sha of target branch of pr we are mergin into
        baseSha: string;
        //branch name of pr we are merging. eg feature-branch
        headRef: string;
        //branch name of target branch of pr we are merging into . eg main
        baseRef: string;
    };
};

// RECEIVED: webhook arrived, but may not have reached the queue yet, ENQUEUED: webhook was safely handed off for processing, FAILED: something went wrong
type DeliveryState = "RECEIVED" | "ENQUEUED" | "FAILED";

//object type shape for dyanmodb record used to record webhook deleiveries, for preventing duplicate processing of same pr using dedup
export type DeliveryItem = {
    pk: string; //primary key for dynamodb
    sk: string; //sort key for dynamodb
    deliveryId: string;//the GitHub delivery ID
    state: DeliveryState;//where this delivery is in processing
    eventName: string; //webhook type, like pull_request
    action: string; //webhook action, like opened
    repositoryId: number; //repo this belongs to
    installationId: number; //GitHub App installation ID
    receivedAt: string; //when your app received it
    enqueuedAt?: string; //optional as record can exist in RECEIVED state before queue handoff happens, timestamp for when the webhook delivery was successfully handed off to the queue
    ttl: number; //Unix timestamp for when DynamoDB can expire/delete the record so old deduple records not live forever
};

//type object/interface shape to check if we have alr seen webhooks github delveiry id in storage, any delieverystore item will have the getDelievery method which takes a deliveryId and returns a promise that resolves to a DeliveryItem or null if not found, this is used for deduplication to check if we have already processed a webhook with the same delivery ID before
export type DeliveryStore = {
    getDelivery(deliveryId: string): Promise<DeliveryItem | null>;
};

//helper that uses above type
const hasDeliveryBeenSeen = async(deliveryId: string, store: DeliveryStore): Promise<boolean> => {
    const existingDelivery = await store.getDelivery(deliveryId);
    return existingDelivery !== null;
};

export {verifyWebhookSignature, isRepositoryAllowed, hasDeliveryBeenSeen};
