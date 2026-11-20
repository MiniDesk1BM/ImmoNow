import { useEffect, useId, useState } from "react";
import type { Commune } from "../types";

const libelle = (c: Commune): string => `${c.nom} (${c.codePostal})`;

interface Props {
  communes: Commune[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Choix de la commune de référence parmi des centaines : saisie avec suggestions (datalist native, filtrée
 * par le navigateur). La sélection n'est validée que si le texte correspond exactement à une commune ;
 * sinon on revient à la commune courante en quittant le champ (jamais d'identifiant arbitraire dans l'état).
 */
export function CommuneSelect({ communes, value, onChange }: Props) {
  const listId = useId();
  const courante = communes.find((c) => c.id === value);
  const [texte, setTexte] = useState(courante ? libelle(courante) : "");
  useEffect(() => setTexte(courante ? libelle(courante) : ""), [courante]);

  const trouver = (t: string): Commune | undefined => communes.find((c) => libelle(c) === t);

  return (
    <label>Ville de référence
      <input
        type="text"
        list={listId}
        value={texte}
        maxLength={80}
        autoComplete="off"
        placeholder="Tapez une commune du Nord ou du Pas-de-Calais"
        onChange={(e) => {
          setTexte(e.target.value);
          const c = trouver(e.target.value);
          if (c) onChange(c.id);
        }}
        onBlur={() => setTexte(courante ? libelle(courante) : "")}
      />
      <datalist id={listId}>
        {communes.map((c) => (
          <option key={c.id} value={libelle(c)} />
        ))}
      </datalist>
    </label>
  );
}
