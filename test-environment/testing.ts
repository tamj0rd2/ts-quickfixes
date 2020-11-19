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

export const personWithOneProperty: Person = {
  lastName: 'my last name',
}

export const singleLinePerson: Person = { birthday: new Date(), status: 'Alive' }
