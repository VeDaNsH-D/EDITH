const isValidDateYYYYMMDD = (value) => /^\d{8}$/.test(value)
const isValidZip = (value) => /^\d{5}(-\d{4})?$/.test(value)
const isValidMoney = (value) => /^-?\d+(\.\d{1,2})?$/.test(value)
const isValidCpt = (value) => /^(HC|AD|ER):[A-Z0-9]{4,5}/.test(value)

export const isValidNpi = (npi) => {
  if (!/^\d{10}$/.test(npi)) return false
  const digits = `80840${npi}`.split('').map(Number)
  let sum = 0
  let alternate = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i]
    if (alternate) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    alternate = !alternate
  }

  return sum % 10 === 0
}

export const helpers = {
  isValidDateYYYYMMDD,
  isValidZip,
  isValidMoney,
  isValidCpt,
}
