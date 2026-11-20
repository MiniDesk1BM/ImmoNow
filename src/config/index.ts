import { parseAidRules } from "../schemas";
import rules2025 from "./aides.2025.json";

/** Pour changer de millésime : ajouter aides.<année>.json et pointer ici. Validé au chargement. */
export const aidRules = parseAidRules(rules2025);
