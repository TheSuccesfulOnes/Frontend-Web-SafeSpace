/** Registration rules shared by field feedback and submit validation. */
export function passwordRequirements(password: string) {
  return {
    passwordMinimum: Array.from(password).length >= 8,
    passwordUppercase: /\p{Lu}/u.test(password),
    passwordLowercase: /\p{Ll}/u.test(password),
    passwordNumber: /\p{Nd}/u.test(password),
    passwordSpecial: /[^\p{L}\p{N}\p{Z}\s\p{C}]/u.test(password),
  };
}

export function passwordWithinLimit(password: string): boolean {
  // BCrypt accepts at most 72 UTF-8 bytes, which can be fewer than 72 characters.
  return new TextEncoder().encode(password).length <= 72;
}

export function isRegistrationPasswordValid(password: string): boolean {
  return (
    Object.values(passwordRequirements(password)).every(Boolean) &&
    passwordWithinLimit(password)
  );
}
