"use client";

import { useId } from "react";
import type { UiLang } from "@/lib/ui-language";

type StarIconProps = {
  fillPercent: number;
};

function StarIcon({ fillPercent }: StarIconProps) {
  return (
    <span className="star-icon" aria-hidden="true">
      <span className="star-base">☆</span>
      <span className="star-fill" style={{ width: `${fillPercent}%` }}>
        ★
      </span>
    </span>
  );
}

type StarRatingProps = {
  value: number;
  max?: number;
  className?: string;
};

export function StarRating({ value, max = 5, className = "" }: StarRatingProps) {
  return (
    <span className={`star-rating ${className}`.trim()} aria-label={`${value.toFixed(1)} / ${max}`}>
      {Array.from({ length: max }, (_, index) => {
        const star = index + 1;
        const fillPercent = value >= star ? 100 : value >= star - 0.5 ? 50 : 0;
        return <StarIcon key={star} fillPercent={fillPercent} />;
      })}
    </span>
  );
}

type StarRatingInputProps = {
  value: number;
  onChange: (next: number) => void;
  max?: number;
  lang: UiLang;
  disabled?: boolean;
};

export function StarRatingInput({ value, onChange, max = 5, lang, disabled = false }: StarRatingInputProps) {
  const idPrefix = useId();
  const hint = lang === "en" ? "Click star halves to rate" : "点击星星左右半颗评分";

  return (
    <div className="star-rating-input-wrap">
      <div className="star-rating-input" role="group" aria-label={hint}>
        {Array.from({ length: max }, (_, index) => {
          const star = index + 1;
          const fillPercent = value >= star ? 100 : value >= star - 0.5 ? 50 : 0;
          return (
            <span className="star-cell" key={`${idPrefix}-${star}`}>
              <button
                type="button"
                className="star-hit star-hit-left"
                onClick={() => onChange(star - 0.5)}
                disabled={disabled}
                aria-label={lang === "en" ? `${star - 0.5} stars` : `${star - 0.5} 星`}
              />
              <button
                type="button"
                className="star-hit star-hit-right"
                onClick={() => onChange(star)}
                disabled={disabled}
                aria-label={lang === "en" ? `${star} stars` : `${star} 星`}
              />
              <StarIcon fillPercent={fillPercent} />
            </span>
          );
        })}
      </div>
      <span className="muted">{hint}</span>
    </div>
  );
}
