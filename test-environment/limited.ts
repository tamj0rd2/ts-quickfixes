interface Job {
  name: string
  compensation: {
    salary: number
    includesHealthcare: boolean
  }
  responsibilities: { description: string }[]
}

export const job: Job = {
  name: 'todo',
  compensation: {},
  responsibilities: [{}],
}
