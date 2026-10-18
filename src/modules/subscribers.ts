/**
 * Point de câblage des réactions aux événements métier : chaque module déclare ses abonnés,
 * ce fichier les enregistre sur le bus (chargé au premier événement publié).
 */
import { eventBus } from "@/infrastructure/event-bus";
import { registerSubscribers as loyaltySubscribers } from "./loyalty";
import { registerSubscribers as notificationSubscribers } from "./notifications";

notificationSubscribers(eventBus);
loyaltySubscribers(eventBus);
