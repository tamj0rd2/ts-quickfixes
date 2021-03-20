/* eslint-disable */
interface PhoneNumber {
  countryCode: string
  phoneNumber: number
}

export interface Person {
  firstName: string
  lastName: string
  birthday: Date
  address: { city: string; postcode: string }
  mobileNumber: PhoneNumber
  status: 'Alive' | 'Dead'
}

interface Employee extends Person {
  department: string
}

export const employee: Employee = {}
