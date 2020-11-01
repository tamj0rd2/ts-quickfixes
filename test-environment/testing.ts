interface PhoneNumber {
  countryCode: string
  phoneNumber: number
}

interface Person {
  firstName: string
  lastName: string
  birthday: Date
  address: { city: string; postcode: string }
  mobileNumber: PhoneNumber
  status: 'Alive' | 'Dead'
}

export const aPerson: Person = {}

export const anotherPerson: Person = {
  lastName: 'my name',
}
