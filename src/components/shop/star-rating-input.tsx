"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/** Clickable 1-5 star picker. Submits as a plain hidden input, so it works
 *  inside a native <form action={serverAction}>. */
export function StarRatingInput({
  name,
  defaultValue = 0,
}: {
  name: string;
  defaultValue?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="inline-flex items-center gap-0.5">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <Star
            className={`h-7 w-7 ${n <= display ? "text-brand-gold" : "text-ink/15"}`}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
    </div>
  );
}
