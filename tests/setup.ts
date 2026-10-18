/**
 * Préparation commune des tests : base dédiée (MONGODB_URI_TEST), vidée par chaque test.
 * Importé en premier par chaque fichier de test, avant tout module de l'application.
 */
import "dotenv/config";

const testUri = process.env.MONGODB_URI_TEST;
if (!testUri) throw new Error("MONGODB_URI_TEST manquant dans .env (base séparée, vidée par les tests)");
process.env.MONGODB_URI = testUri;
(process.env as Record<string, string>).NODE_ENV = "test";
