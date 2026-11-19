import mongoose from 'mongoose';

type MongoTopologyDescription = {
  type?: string;
};

type MongoTopology = {
  description?: MongoTopologyDescription;
  s?: { description?: MongoTopologyDescription };
  hasSessionSupport?: () => boolean;
};

type MongoClientWithTopology = mongoose.mongo.MongoClient & {
  topology?: MongoTopology;
  options?: { replicaSet?: string };
};

let cachedSupport: boolean | null = null;

function resolveClient(): MongoClientWithTopology | undefined {
  const connection = mongoose.connection as typeof mongoose.connection & {
    client?: MongoClientWithTopology;
    getClient?: () => MongoClientWithTopology;
  };

  if (typeof connection.getClient === 'function') {
    return connection.getClient();
  }

  return connection.client;
}

function topologyType(client: MongoClientWithTopology): string | undefined {
  const topology = client.topology;
  if (!topology) return undefined;
  const description = topology.description ?? topology.s?.description;
  return description?.type;
}

export function supportsMongoTransactions(): boolean {
  if (cachedSupport !== null) {
    return cachedSupport;
  }

  const client = resolveClient();
  if (!client) {
    cachedSupport = false;
    return cachedSupport;
  }

  const topology = client.topology;
  if (topology?.hasSessionSupport && !topology.hasSessionSupport()) {
    cachedSupport = false;
    return cachedSupport;
  }

  const type = topologyType(client);
  if (type) {
    const supportedTypes = new Set(['ReplicaSetWithPrimary', 'Sharded', 'LoadBalanced']);
    cachedSupport = supportedTypes.has(type);
    if (cachedSupport) {
      return cachedSupport;
    }
  }

  const options = client.options;
  if (options && typeof options.replicaSet === 'string' && options.replicaSet.length > 0) {
    cachedSupport = true;
    return cachedSupport;
  }

  cachedSupport = false;
  return cachedSupport;
}

export function setMongoTransactionSupport(value: boolean) {
  cachedSupport = value;
}
