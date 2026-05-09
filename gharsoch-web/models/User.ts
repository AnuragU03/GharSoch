import { ObjectId } from 'mongodb'

export type UserRole = 'admin' | 'tech' | 'broker'
export type UserStatus = 'pending_approval' | 'active' | 'suspended'

export interface User {
  _id?: ObjectId
  email: string
  name: string
  image?: string | null
  role: UserRole
  status: UserStatus
  /** null for admin/tech; required (set at promotion time) for broker */
  brokerage_id?: ObjectId | null
  created_at: Date
  last_login_at: Date
  promoted_by_user_id?: ObjectId | null
  promoted_at?: Date | null
}

export const DEFAULT_USER_ROLE: UserRole = 'broker'
export const DEFAULT_USER_STATUS: UserStatus = 'pending_approval'
