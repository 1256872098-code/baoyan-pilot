import React from "react";

export function TextField({ label, name, value, onChange, placeholder, type = "text", min, max }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        className="field-control"
        type={type}
        name={name}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={onChange}
      />
    </label>
  );
}

export function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field-control" name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({ label, name, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <textarea
        className="field-control resize-y"
        name={name}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={onChange}
      />
    </label>
  );
}
