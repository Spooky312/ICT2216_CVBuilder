
export function errorProps(errors, name, inputId) {
  const invalid = Boolean(errors?.[name]);
  return {
    'aria-invalid': invalid,
    'aria-describedby': invalid ? `${inputId}-error` : undefined,
  };
}

export default function FieldError({ errors, name, inputId }) {
  if (!errors?.[name]) return null;
  return <small id={`${inputId}-error`} className="field-error">{errors[name]}</small>;
}
