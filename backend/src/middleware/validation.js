const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const toSafeString = (value) => String(value ?? "").trim();

export const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

export const validateEmail = (email) => emailRegex.test(toSafeString(email));

export const validatePassword = (password) => toSafeString(password).length >= 6;
export const validateDateYMD = (date) => /^\d{4}-\d{2}-\d{2}$/.test(toSafeString(date));

export const ensureNonEmpty = (value, fieldName) => {
  const safe = toSafeString(value);
  if (!safe) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    throw err;
  }
  return safe;
};

export const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
};
