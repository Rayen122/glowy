import mongoose, { type ClientSession } from "mongoose";

/**
 * Connexion MongoDB unique (Mongoose) — seule porte d'entrée vers la base.
 * Mongoose met les requêtes en attente tant que la connexion n'est pas ouverte :
 * il suffit d'appeler connectDb() une fois (fait par ./models au premier import).
 * L'état est porté par l'instance Mongoose elle-même, pas par globalThis : selon l'ordre de chargement, le serveur
 * Next.js peut obtenir deux instances (pages et routes API) et chacune doit ouvrir sa connexion, sinon les requêtes
 * des pages attendent indéfiniment (« buffering timed out ») alors que /api/health répond.
 */
const globalForMongo = mongoose as typeof mongoose & { glowyConnection?: Promise<typeof mongoose>; glowyTransactions?: Promise<boolean> };

mongoose.set("strictQuery", true);

export function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant : copiez .env.example en .env (voir README)");
  globalForMongo.glowyConnection ??= mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 8_000,
      // IPv4 directement : sur Vercel, l'essai IPv6 vers Atlas expirait avant le repli (démarrages à froid de 30 à 100 s)
      family: 4,
      // Peu de connexions par instance : moins de poignées de main TLS au démarrage d'une fonction serverless
      maxPoolSize: 10,
      // Production : index créés une fois (seed ou script), pas à chaque démarrage d'instance
      autoIndex: process.env.NODE_ENV !== "production",
    })
    .catch((error) => {
      globalForMongo.glowyConnection = undefined;
      throw error;
    });
  return globalForMongo.glowyConnection;
}

export async function pingDb() {
  const m = await connectDb();
  await m.connection.db!.admin().ping();
}

export async function disconnectDb() {
  await mongoose.disconnect();
  globalForMongo.glowyConnection = undefined;
  globalForMongo.glowyTransactions = undefined;
}

/** Les transactions exigent un replica set (docker-compose.yml, MongoDB Atlas) ; un serveur autonome n'en a pas. */
function transactionsSupported() {
  globalForMongo.glowyTransactions ??= connectDb().then(async (m) => {
    const hello = await m.connection.db!.admin().command({ hello: 1 });
    return Boolean(hello.setName) || hello.msg === "isdbgrid";
  });
  return globalForMongo.glowyTransactions;
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
