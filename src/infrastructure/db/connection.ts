import mongoose, { type ClientSession } from "mongoose";

/**
 * Connexion MongoDB unique (Mongoose) — seule porte d'entrée vers la base.
 * Mongoose met les requêtes en attente tant que la connexion n'est pas ouverte :
 * il suffit d'appeler connectDb() une fois (fait par ./models au premier import).
 */
const globalForMongo = globalThis as unknown as { mongoConnection?: Promise<typeof mongoose>; mongoTransactions?: Promise<boolean> };

mongoose.set("strictQuery", true);

export function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant : copiez .env.example en .env (voir README)");
  globalForMongo.mongoConnection ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 8_000 }).catch((error) => {
    globalForMongo.mongoConnection = undefined;
    throw error;
  });
  return globalForMongo.mongoConnection;
}

export async function pingDb() {
  const m = await connectDb();
  await m.connection.db!.admin().ping();
}

export async function disconnectDb() {
  await mongoose.disconnect();
  globalForMongo.mongoConnection = undefined;
  globalForMongo.mongoTransactions = undefined;
}

/** Les transactions exigent un replica set (docker-compose.yml, MongoDB Atlas) ; un serveur autonome n'en a pas. */
function transactionsSupported() {
  globalForMongo.mongoTransactions ??= connectDb().then(async (m) => {
    const hello = await m.connection.db!.admin().command({ hello: 1 });
    return Boolean(hello.setName) || hello.msg === "isdbgrid";
  });
  return globalForMongo.mongoTransactions;
}

/**
 * Exécute `work` dans une transaction quand la base le permet (tout ou rien),
 * sinon directement — les opérations critiques restent protégées par des index uniques
 * et des mises à jour atomiques ($inc conditionnels).
 */
export async function withTransaction<T>(work: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  await connectDb();
  if (!(await transactionsSupported())) return work(undefined);
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Erreur d'index unique MongoDB (E11000) */
export const isDuplicateKey = (error: unknown) => (error as { code?: number } | null)?.code === 11000;
