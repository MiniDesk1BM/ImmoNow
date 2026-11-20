import type { AidRules } from "../types";
import rules2025 from "./aides.2025.json";

/** Pour changer de millésime : ajouter aides.<année>.json et pointer ici. */
export const aidRules = rules2025 as unknown as AidRules;
