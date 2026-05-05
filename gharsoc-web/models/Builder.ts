import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getBuilderCollection() {
  return await getCollection('builders')
}

export interface Builder {
  _id?: ObjectId
  name: string
  city: string
  notable_projects: string[]
  description: string
  website: string
  created_at: Date
  updated_at: Date
}

export const CITIES = ['Ahmedabad', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai'] as const
export type City = typeof CITIES[number]

// Top 5 builders per city — useful context for the voice agent
export const SEED_BUILDERS: Omit<Builder, '_id'>[] = [
  // Ahmedabad
  {
    city: 'Ahmedabad',
    name: 'Adani Realty',
    notable_projects: ['Shantigram', 'Adani Samsara', 'Adani Oyster Grande'],
    description: 'One of the largest developers in Ahmedabad with integrated townships and luxury residential projects.',
    website: 'https://www.adanirealty.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Ahmedabad',
    name: 'Safal Group',
    notable_projects: ['Safal Parisar', 'Safal Solitaire', 'Safal Prelude'],
    description: 'Prominent Ahmedabad builder known for affordable and mid-segment housing across the city.',
    website: 'https://www.safalgroup.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Ahmedabad',
    name: 'Goyal & Co.',
    notable_projects: ['Orchid Greens', 'Orchid Suburbia', 'Orchid Whitefield'],
    description: 'Established Ahmedabad developer with a strong portfolio of residential and commercial projects.',
    website: 'https://www.goyalandco.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Ahmedabad',
    name: 'Shivalik Group',
    notable_projects: ['Shivalik Sharda', 'Shivalik Greens', 'Shivalik Satyamev'],
    description: 'Trusted builder in Ahmedabad delivering quality residential complexes for over two decades.',
    website: 'https://www.shivalikgroup.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Ahmedabad',
    name: 'Savvy Infrastructure',
    notable_projects: ['Savvy Swaraj', 'Savvy Swaraj 2', 'Savvy Solaris'],
    description: 'Known for premium residential and commercial developments in Ahmedabad\'s growth corridors.',
    website: 'https://www.savvyinfra.com',
    created_at: new Date(), updated_at: new Date(),
  },

  // Bangalore
  {
    city: 'Bangalore',
    name: 'Prestige Group',
    notable_projects: ['Prestige Shantiniketan', 'Prestige Lakeside Habitat', 'Prestige Falcon City'],
    description: 'One of South India\'s most reputed developers with luxury residential, commercial, and retail projects across Bangalore.',
    website: 'https://www.prestigeconstructions.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Bangalore',
    name: 'Brigade Group',
    notable_projects: ['Brigade Orchards', 'Brigade Utopia', 'Brigade Cornerstone Utopia'],
    description: 'Leading Bangalore developer known for integrated townships and premium residential communities.',
    website: 'https://www.brigadegroup.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Bangalore',
    name: 'Sobha Limited',
    notable_projects: ['Sobha Dream Acres', 'Sobha City', 'Sobha Indraprastha'],
    description: 'Premium builder with a reputation for quality construction and on-time delivery across Bangalore.',
    website: 'https://www.sobha.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Bangalore',
    name: 'Godrej Properties',
    notable_projects: ['Godrej Splendour', 'Godrej Eternity', 'Godrej United'],
    description: 'Trusted national developer with a strong Bangalore presence offering mid to premium segment homes.',
    website: 'https://www.godrejproperties.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Bangalore',
    name: 'Puravankara',
    notable_projects: ['Purva Atmosphere', 'Purva Zenium', 'Purva Windermere'],
    description: 'Established Bangalore developer with a wide range of affordable to luxury residential projects.',
    website: 'https://www.puravankara.com',
    created_at: new Date(), updated_at: new Date(),
  },

  // Mumbai
  {
    city: 'Mumbai',
    name: 'Lodha Group',
    notable_projects: ['World One', 'Lodha Palava', 'Lodha Park'],
    description: 'India\'s largest real estate developer by sales, known for ultra-luxury and large-scale township projects in Mumbai.',
    website: 'https://www.lodhagroup.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Mumbai',
    name: 'Godrej Properties',
    notable_projects: ['Godrej Horizon', 'Godrej Emerald', 'Godrej Alive'],
    description: 'Premium developer with a strong Mumbai portfolio spanning affordable to luxury segments.',
    website: 'https://www.godrejproperties.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Mumbai',
    name: 'Oberoi Realty',
    notable_projects: ['Oberoi Exquisite', 'Oberoi Sky City', 'Oberoi Garden City'],
    description: 'Luxury developer in Mumbai known for high-end residential towers and integrated townships.',
    website: 'https://www.oberoirealty.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Mumbai',
    name: 'Hiranandani Group',
    notable_projects: ['Hiranandani Gardens Powai', 'Hiranandani Estate Thane', 'Hiranandani Fortune City'],
    description: 'Iconic Mumbai developer famous for self-sustained townships with world-class infrastructure.',
    website: 'https://www.hiranandani.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Mumbai',
    name: 'Rustomjee',
    notable_projects: ['Rustomjee Seasons', 'Rustomjee Urbania', 'Rustomjee Elements'],
    description: 'Reputed Mumbai builder delivering quality residential and commercial projects across the MMR region.',
    website: 'https://www.rustomjee.com',
    created_at: new Date(), updated_at: new Date(),
  },

  // Delhi
  {
    city: 'Delhi',
    name: 'DLF Limited',
    notable_projects: ['DLF The Crest', 'DLF Camellias', 'DLF Magnolias'],
    description: 'India\'s largest listed real estate company with iconic luxury and commercial projects across Delhi NCR.',
    website: 'https://www.dlf.in',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Delhi',
    name: 'Emaar India',
    notable_projects: ['Emaar Gurgaon Greens', 'Emaar Palm Heights', 'Emaar Marbella'],
    description: 'Global developer with premium residential and commercial projects in Delhi NCR.',
    website: 'https://www.emaarindia.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Delhi',
    name: 'Sobha Limited',
    notable_projects: ['Sobha International City', 'Sobha City Gurgaon', 'Sobha Aranya'],
    description: 'Quality-focused developer with premium residential projects in Delhi NCR.',
    website: 'https://www.sobha.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Delhi',
    name: 'Godrej Properties',
    notable_projects: ['Godrej Meridien', 'Godrej Summit', 'Godrej Icon'],
    description: 'Trusted developer with a growing portfolio of premium residential projects in Delhi NCR.',
    website: 'https://www.godrejproperties.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Delhi',
    name: 'Tata Housing',
    notable_projects: ['Tata Primanti', 'Tata Raisina Residency', 'Tata Eureka Park'],
    description: 'Tata Group\'s real estate arm known for quality construction and timely delivery in Delhi NCR.',
    website: 'https://www.tatahousing.in',
    created_at: new Date(), updated_at: new Date(),
  },

  // Chennai
  {
    city: 'Chennai',
    name: 'Casagrand Builder',
    notable_projects: ['Casagrand Supremus', 'Casagrand Lorenza', 'Casagrand Utopia'],
    description: 'One of Chennai\'s fastest-growing developers with a large portfolio of affordable and mid-segment homes.',
    website: 'https://www.casagrand.co.in',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Chennai',
    name: 'Prestige Group',
    notable_projects: ['Prestige Bella Vista', 'Prestige Courtyards', 'Prestige Ferns Residency'],
    description: 'South India\'s leading developer with premium residential projects in Chennai.',
    website: 'https://www.prestigeconstructions.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Chennai',
    name: 'Godrej Properties',
    notable_projects: ['Godrej Ananda', 'Godrej Nurture', 'Godrej Azure'],
    description: 'Premium developer with quality residential projects across Chennai\'s key micro-markets.',
    website: 'https://www.godrejproperties.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Chennai',
    name: 'Shriram Properties',
    notable_projects: ['Shriram Summitt', 'Shriram Chirping Woods', 'Shriram Park 63'],
    description: 'Established Chennai developer known for affordable and mid-segment residential projects.',
    website: 'https://www.shriramproperties.com',
    created_at: new Date(), updated_at: new Date(),
  },
  {
    city: 'Chennai',
    name: 'TVS Emerald',
    notable_projects: ['TVS Emerald Jardin', 'TVS Emerald Aaranya', 'TVS Emerald GreenAcres'],
    description: 'TVS Group\'s real estate arm delivering premium residential projects in Chennai.',
    website: 'https://www.tvsemeraldhomes.com',
    created_at: new Date(), updated_at: new Date(),
  },
]
