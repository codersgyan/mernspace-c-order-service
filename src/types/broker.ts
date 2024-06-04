export interface MessageBroker {
  connectConsumer: () => Promise<void>;
  disconnectConsumer: () => Promise<void>;
  consumeMessage: (topics: string[], fromBeginning: boolean) => Promise<void>;
}
