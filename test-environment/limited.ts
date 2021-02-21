interface Responsibility {
  description: string
}

interface Job {
  name: string
  compensation: {
    salary: number
    includesHealthcare: boolean
  }
  responsibilities: Responsibility[]
}

export const job: Job = {
  name: 'todo',
  compensation: {},
  responsibilities: [{}],
}
