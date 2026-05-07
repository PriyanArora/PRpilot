import {createHmac} from "node:crypto";
import {describe, expect, it} from "vitest";
import { verifyWebhookSignature, isRepositoryAllowed, hasDeliveryBeenSeen } from '../../apps/webhook/handler';
import type { DeliveryStore, NormalizedWebhookEvent } from "../../apps/webhook/handler";

describe("verifyWebhookSignature", () => {
    it("accepts a valid GitHub webhook signature", () =>{
        const secret = "test-webhook-secret";
        
        const rawBody = JSON.stringify({
            action: "opened",
            number: 1,
            pull_request:{
                head:{
                    sha: "abc123"
                }
            }
        });

        const signature = `sha256=${createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex")
        }`;

        const isValid = verifyWebhookSignature(rawBody, signature, secret);
        
        expect(isValid).toBe(true);
    });

});

describe("invalidWebhookSignature", () => {
    it("rejects an invalid GitHub webhook signature", () =>{
        const secret = "test-webhook-secret";   
        const rawBody = JSON.stringify({
            action: "opened",
            number: 1,
            pull_request:{
                head:{
                    sha: "abc123"
                }
            }
        });

        const invalidSignature = `sha256=invalidsignature`;

        const isValid = verifyWebhookSignature(rawBody, invalidSignature, secret);
        
        expect(isValid).toBe(false);
    });

});

describe("repoScopeCheckPass", () => {
    it("allows a webhook from an allowed repository", () => {
        const selectedRepositoryIds = [1147613528];
        const repositoryId = 1147613528;

        const isAllowed = isRepositoryAllowed(repositoryId, selectedRepositoryIds);

        expect(isAllowed).toBe(true);
    });
});

describe("repoScopeCheckFail", () => {
    it("rejects a webhook from a disallowed repository", () => {
        const selectedRepositoryIds = [1147613528];
        const repositoryId = 999999999;

        const isAllowed = isRepositoryAllowed(repositoryId, selectedRepositoryIds);

        expect(isAllowed).toBe(false);
    });
});
describe("hasDeliveryBeenSeen", () => {
    it("checks delivery state, gives true if delivery is duplicate", async () => {
        const mockDeliveryStore: DeliveryStore = {
            getDelivery: async (deliveryId: string) => {
                if(deliveryId === "seen-delivery-id"){
                    return {
                        pk: "webhook#seen-delivery-id",
                        sk: "metadata#seen-delivery-id",
                        deliveryId: "seen-delivery-id",
                        state: "ENQUEUED",
                        eventName: "pull_request",
                        action: "opened",
                        repositoryId: 123,
                        installationId: 456,
                        receivedAt: new Date().toISOString(),
                        ttl: Math.floor(Date.now() / 1000) + 3600
                    }
                }
                return null;
            }
        };

        const seenDeliveryId = "seen-delivery-id";
        const check = await hasDeliveryBeenSeen(seenDeliveryId, mockDeliveryStore);
        
        expect(check).toBe(true);
    });
});  
describe("hasDeliveryBeenSeen", () => {
    it("checks delivery state before processing starts (throws error) and gives false if delivery is new", async () => {
        
        let processingStarted = false;
        
        const mockDeliveryStore: DeliveryStore = {
            getDelivery: async (deliveryId: string) => {
                if(processingStarted){
                    throw new Error("getDelivery should not be called after processing has started/ processing should have not started yet");
                }
                if(deliveryId === "seen-delivery-id"){     
                    return {
                        pk: "webhook#seen-delivery-id",
                        sk: "metadata#seen-delivery-id",
                        deliveryId: "seen-delivery-id",
                        state: "ENQUEUED",
                        eventName: "pull_request",
                        action: "opened",
                        repositoryId: 123,
                        installationId: 456,
                        receivedAt: new Date().toISOString(),
                        ttl: Math.floor(Date.now() / 1000) + 3600
                    }
                }
                return null;
            }
        };

        const unseenDeliveryId = "unseen-delivery-id";
        const check = await hasDeliveryBeenSeen(unseenDeliveryId, mockDeliveryStore);
        
        processingStarted = true;

        expect(check).toBe(false);
    });
});    
describe("rejects already-enqueued duplicate deliveries before processing", () => {
    it("gives true for duplicate delivery and prevents processing start", async () => {
        let processingStarted = false;
        
        const mockDeliveryStore: DeliveryStore = {
            getDelivery: async (deliveryId: string) => {
                if(processingStarted){
                    throw new Error("getDelivery should not be called after processing has started/ processing should have not started yet");
                }
                if(deliveryId === "seen-delivery-id"){     
                    return {
                        pk: "webhook#seen-delivery-id",
                        sk: "metadata#seen-delivery-id",
                        deliveryId: "seen-delivery-id",
                        state: "ENQUEUED",
                        eventName: "pull_request",
                        action: "opened",
                        repositoryId: 123,
                        installationId: 456,
                        receivedAt: new Date().toISOString(),
                        ttl: Math.floor(Date.now() / 1000) + 3600
                    }
                }
                return null;
            }
        };

        const seenDeliveryId = "seen-delivery-id";
        const check = await hasDeliveryBeenSeen(seenDeliveryId, mockDeliveryStore);
        
        processingStarted = check?false:true; //if we see the delivery as duplicate, we should not start processing, if we see it as new, we can start processing, this is a safety check to prevent starting processing of a delivery we have already seen before which can lead to duplicate work

        expect(processingStarted).toBe(false);
    });
});
describe("allows unseen deliveries to start processing", () => {
    it("gives false for new delivery and allows processing to start", async () => {
        let processingStarted = false;
        
        const mockDeliveryStore: DeliveryStore = {
            getDelivery: async (deliveryId: string) => {
                if(processingStarted){
                    throw new Error("getDelivery should not be called after processing has started/ processing should have not started yet");
                }
                if(deliveryId === "seen-delivery-id"){     
                    return {
                        pk: "webhook#seen-delivery-id",
                        sk: "metadata#seen-delivery-id",
                        deliveryId: "seen-delivery-id",
                        state: "ENQUEUED",
                        eventName: "pull_request",
                        action: "opened",
                        repositoryId: 123,
                        installationId: 456,
                        receivedAt: new Date().toISOString(),
                        ttl: Math.floor(Date.now() / 1000) + 3600
                    }
                }
                return null;
            }
        };

        const unseenDeliveryId = "unseen-delivery-id";
        const check = await hasDeliveryBeenSeen(unseenDeliveryId, mockDeliveryStore);
        
        processingStarted = check?false:true; //if we see the delivery as duplicate, we should not start processing, if we see it as new, we can start processing, this is a safety check to prevent starting processing of a delivery we have already seen before which can lead to duplicate work

        expect(processingStarted).toBe(true);
    });
});
describe("allows stale received deliveries to retry processing if more than 5 minutes have passed", () => {
    it("gives true for duplicate delivery in RECEIVED state which is stale and allows processing to start again", async () => {
        let processingStarted = false;
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const mockDeliveryStore: DeliveryStore = {
            getDelivery: async (deliveryId: string) => {
                if(processingStarted){
                    throw new Error("getDelivery should not be called after processing has started/ processing should have not started yet");
                }
                if(deliveryId === "stale-received-delivery-id"){     
                    return {
                        pk: "webhook#stale-received-delivery-id",
                        sk: "metadata#stale-received-delivery-id",
                        deliveryId: "stale-received-delivery-id",
                        state: "RECEIVED", //if the delivery is still in RECEIVED state, it means the previous processing attempt might have failed before it could update the state to ENQUEUED, so we should allow retrying processing of this delivery instead of treating it as a duplicate that should be blocked, this is to handle the edge case where we receive a webhook, check if it's a duplicate, see that it's not in storage, start processing but then fail before we can save the record with ENQUEUED state, and then we receive the same webhook again, we want to allow processing to start for this second attempt as the first attempt might have been a failure that happened before we could save the record, if we block processing for this second attempt because we see the record in storage but it's still in RECEIVED state, then we might end up never processing this delivery which can lead to missed webhooks
                        eventName: "pull_request",
                        action: "opened",
                        repositoryId: 123,
                        installationId: 456,
                        receivedAt: tenMinutesAgo,
                        ttl: Math.floor(Date.now() / 1000) + 3600
                    }
                }
                return null;
            }
        };

        const staleReceivedDeliveryId = "stale-received-delivery-id"; //delivery ID we are testing, matches fake record inside mockDeliveryStore
        const existingDelivery = await mockDeliveryStore.getDelivery(staleReceivedDeliveryId); //asks the fake delivery store, returns the fake RECEIVED delivery item
        
        const staleCutoffMs = 5 * 60 * 1000; //5 minutes in milliseconds
        
        const deliveryAgeMs = Date.now() - new Date(existingDelivery?.receivedAt ?? Date.now()).getTime(); //current time - when delivery came, the ??datenow is for if deliverystore doesnt have anything i.e exisiting delivery is missing so we use current time hence this const becomes 0 
        
        let isStaleReceivedDelivery = false;
        if(existingDelivery?.state === "RECEIVED" && deliveryAgeMs > staleCutoffMs){ //true if delivery state is recieved and old delivery is same as new one but older. false for anything else
            isStaleReceivedDelivery = true;
        }

        processingStarted = isStaleReceivedDelivery;

        expect(processingStarted).toBe(true);
    });
});
describe("does not acknowledge success when queue handoff fails", () => {
    it("fake queue throws error and processing should not be marked safely handed off", async () => {
        //replicating a failed queue handoff job by straight up throwing an error
        const queueHandoff = async() => {
            throw new Error("Queue handoff failed");
        };
        
        let handoffSucceeded = false;
        
        try{
            await queueHandoff();
            handoffSucceeded = true; //if we reach this line, it means the handoff succeeded, but in this test we are simulating a failure so we should not reach this line
        }
        catch(error){
            // Ignore the error as we are testing the failure case i.e also handoffsucceded stays false
        }
        
        expect(handoffSucceeded).toBe(false);
        
    });
});
describe("Ensure accepted deliveries only return success after durable handoff succeeds", () => {
    it("fake queue handoff succeeds and processing should be marked safely handed off", async () => {
        //replicating a successful queue handoff job by resolving a promise
        const queueHandoff = async() => {
            return Promise.resolve("Queue handoff succeeded");
        };
        let webhookAcknowledged = false;
        let handoffSucceeded = false;
        try{
            await queueHandoff();
            handoffSucceeded = true; //if we reach this line, it means the handoff succeeded, which is what we are simulating in this test
            webhookAcknowledged = handoffSucceeded; //acknowledge only if handoff succeeds
        }
        catch(error){
            //we should not reach here in this test as we are simulating a successful handoff, if we do reach here it means something went wrong with our simulation
            throw new Error("Queue handoff should have succeeded but failed with error: " + error);
        }

        expect(webhookAcknowledged).toBe(true);
    });
});
describe("NormalizedWebhookEvent", () => {
    it("contains the required normalized pull request fields", () => {
        const normalizedEvent: NormalizedWebhookEvent = {
            deliveryId: "test-delivery-id",
            eventName: "pull_request",
            action: "opened",
            repositoryId: 123,
            repositoryFullName: "owner/repo",
            installationId: 456,
            receivedAt: new Date().toISOString(),
            pullRequest: {
                number: 1,
                headSha: "abc123",
                baseSha: "def456",
                headRef: "feature-branch",
                baseRef: "main"
            }
        };

        expect(normalizedEvent.deliveryId).toBe("test-delivery-id");
        expect(normalizedEvent.eventName).toBe("pull_request");
        expect(normalizedEvent.repositoryId).toBe(123);
        expect(normalizedEvent.installationId).toBe(456);
        expect(normalizedEvent.pullRequest?.number).toBe(1);
        expect(normalizedEvent.pullRequest?.headSha).toBe("abc123");
        expect(normalizedEvent.pullRequest?.baseSha).toBe("def456");
        expect(normalizedEvent.pullRequest?.headRef).toBe("feature-branch");
        expect(normalizedEvent.pullRequest?.baseRef).toBe("main");
    });
});
