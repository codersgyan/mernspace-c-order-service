export interface MessageBroker {
  connectProducer: () => Promise<void>;
  disconnectProducer: () => Promise<void>;
  sendMessage: (topic: string, message: string, key?: string) => Promise<void>;
  connectConsumer: () => Promise<void>;
  disconnectConsumer: () => Promise<void>;
  consumeMessage: (topics: string[], fromBeginning: boolean) => Promise<void>;
}
