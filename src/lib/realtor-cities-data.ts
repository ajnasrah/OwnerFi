// Comprehensive list of 1000+ US cities for buyer leads SEO pages
// Organized by state with population data for prioritization

export interface CityData {
  name: string
  state: string
  stateCode: string
  slug: string
  population?: number
  isCapital?: boolean
  isMetro?: boolean
}

export interface StateData {
  name: string
  code: string
  slug: string
  cities: string[]
}

// State mapping for URL slugs
export const STATE_DATA: Record<string, StateData> = {
  'AL': { name: 'Alabama', code: 'AL', slug: 'alabama', cities: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison', 'Florence', 'Gadsden', 'Vestavia Hills', 'Prattville', 'Phenix City'] },
  'AK': { name: 'Alaska', code: 'AK', slug: 'alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak', 'Bethel', 'Palmer'] },
  'AZ': { name: 'Arizona', code: 'AZ', slug: 'arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise', 'Yuma', 'Avondale', 'Goodyear', 'Flagstaff', 'Buckeye', 'Lake Havasu City', 'Casa Grande', 'Sierra Vista', 'Maricopa', 'Oro Valley'] },
  'AR': { name: 'Arkansas', code: 'AR', slug: 'arkansas', cities: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'North Little Rock', 'Conway', 'Rogers', 'Pine Bluff', 'Bentonville', 'Hot Springs', 'Benton', 'Texarkana', 'Sherwood', 'Jacksonville'] },
  'CA': { name: 'California', code: 'CA', slug: 'california', cities: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Moreno Valley', 'Santa Clarita', 'Glendale', 'Huntington Beach', 'Garden Grove', 'Oceanside', 'Rancho Cucamonga', 'Santa Rosa', 'Ontario', 'Elk Grove', 'Corona', 'Lancaster', 'Palmdale', 'Salinas', 'Pomona', 'Hayward', 'Escondido', 'Sunnyvale', 'Torrance', 'Pasadena', 'Orange', 'Fullerton', 'Thousand Oaks', 'Roseville', 'Concord', 'Simi Valley', 'Santa Clara', 'Victorville', 'Vallejo', 'Berkeley', 'El Monte'] },
  'CO': { name: 'Colorado', code: 'CO', slug: 'colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial', 'Boulder', 'Greeley', 'Longmont', 'Loveland', 'Grand Junction', 'Broomfield', 'Castle Rock', 'Commerce City', 'Parker', 'Littleton'] },
  'CT': { name: 'Connecticut', code: 'CT', slug: 'connecticut', cities: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'Bristol', 'Meriden', 'Milford', 'West Haven', 'Middletown', 'Norwich', 'Shelton'] },
  'DE': { name: 'Delaware', code: 'DE', slug: 'delaware', cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna', 'Milford', 'Seaford', 'Georgetown', 'Elsmere', 'New Castle'] },
  'FL': { name: 'Florida', code: 'FL', slug: 'florida', cities: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Port St. Lucie', 'Cape Coral', 'Tallahassee', 'Fort Lauderdale', 'Pembroke Pines', 'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs', 'Miami Gardens', 'Clearwater', 'Palm Bay', 'Pompano Beach', 'West Palm Beach', 'Lakeland', 'Davie', 'Miami Beach', 'Sunrise', 'Boca Raton', 'Deltona', 'Plantation', 'Fort Myers', 'Palm Coast', 'Deerfield Beach', 'Melbourne', 'Boynton Beach', 'Lauderhill', 'Weston', 'Kissimmee', 'North Miami', 'Homestead', 'Tamarac', 'Delray Beach', 'Daytona Beach', 'Wellington', 'North Port', 'Jupiter', 'Ocala', 'Port Orange', 'Margate', 'Coconut Creek', 'Sanford', 'Sarasota', 'Pensacola'] },
  'GA': { name: 'Georgia', code: 'GA', slug: 'georgia', cities: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens', 'Sandy Springs', 'South Fulton', 'Roswell', 'Johns Creek', 'Warner Robins', 'Albany', 'Alpharetta', 'Marietta', 'Stonecrest', 'Smyrna', 'Valdosta', 'Brookhaven', 'Dunwoody', 'Peachtree Corners', 'Gainesville', 'Newnan', 'Milton', 'Rome', 'East Point'] },
  'HI': { name: 'Hawaii', code: 'HI', slug: 'hawaii', cities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu', 'Kaneohe', 'Mililani Town', 'Kahului', 'Ewa Gentry', 'Kihei'] },
  'ID': { name: 'Idaho', code: 'ID', slug: 'idaho', cities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Caldwell', 'Pocatello', 'Coeur d\'Alene', 'Twin Falls', 'Post Falls', 'Lewiston', 'Rexburg', 'Eagle', 'Kuna', 'Moscow', 'Ammon'] },
  'IL': { name: 'Illinois', code: 'IL', slug: 'illinois', cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Elgin', 'Peoria', 'Champaign', 'Waukegan', 'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Decatur', 'Schaumburg', 'Bolingbrook', 'Palatine', 'Skokie', 'Des Plaines'] },
  'IN': { name: 'Indiana', code: 'IN', slug: 'indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington', 'Hammond', 'Gary', 'Lafayette', 'Muncie', 'Terre Haute', 'Kokomo', 'Noblesville', 'Anderson', 'Greenwood', 'Elkhart', 'Mishawaka', 'Lawrence', 'Jeffersonville'] },
  'IA': { name: 'Iowa', code: 'IA', slug: 'iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Ames', 'West Des Moines', 'Council Bluffs', 'Ankeny', 'Dubuque', 'Urbandale', 'Cedar Falls', 'Marion', 'Bettendorf'] },
  'KS': { name: 'Kansas', code: 'KS', slug: 'kansas', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina', 'Hutchinson', 'Leavenworth', 'Leawood', 'Dodge City', 'Garden City'] },
  'KY': { name: 'Kentucky', code: 'KY', slug: 'kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Richmond', 'Georgetown', 'Florence', 'Hopkinsville', 'Nicholasville', 'Elizabethtown', 'Henderson', 'Frankfort', 'Jeffersontown', 'Independence'] },
  'LA': { name: 'Louisiana', code: 'LA', slug: 'louisiana', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Metairie', 'Lafayette', 'Lake Charles', 'Bossier City', 'Kenner', 'Monroe', 'Alexandria', 'Houma', 'Marrero', 'New Iberia', 'Laplace', 'Slidell'] },
  'ME': { name: 'Maine', code: 'ME', slug: 'maine', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Augusta', 'Saco', 'Westbrook'] },
  'MD': { name: 'Maryland', code: 'MD', slug: 'maryland', cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Hagerstown', 'Annapolis', 'College Park', 'Salisbury', 'Laurel', 'Greenbelt', 'Cumberland', 'Westminster', 'Hyattsville', 'Takoma Park'] },
  'MA': { name: 'Massachusetts', code: 'MA', slug: 'massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'New Bedford', 'Quincy', 'Lynn', 'Fall River', 'Newton', 'Lawrence', 'Somerville', 'Framingham', 'Haverhill', 'Waltham', 'Malden', 'Brookline', 'Plymouth', 'Medford'] },
  'MI': { name: 'Michigan', code: 'MI', slug: 'michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Troy', 'Westland', 'Farmington Hills', 'Kalamazoo', 'Wyoming', 'Southfield', 'Rochester Hills', 'Taylor', 'Pontiac', 'St. Clair Shores', 'Royal Oak'] },
  'MN': { name: 'Minnesota', code: 'MN', slug: 'minnesota', cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'St. Cloud', 'Woodbury', 'Eagan', 'Maple Grove', 'Coon Rapids', 'Eden Prairie', 'Burnsville', 'Blaine', 'Lakeville', 'Minnetonka', 'Apple Valley', 'Edina', 'St. Louis Park'] },
  'MS': { name: 'Mississippi', code: 'MS', slug: 'mississippi', cities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Olive Branch', 'Greenville', 'Horn Lake', 'Pearl', 'Madison', 'Clinton', 'Starkville', 'Columbus'] },
  'MO': { name: 'Missouri', code: 'MO', slug: 'missouri', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'Blue Springs', 'St. Peters', 'Florissant', 'Joplin', 'Chesterfield', 'Jefferson City'] },
  'MT': { name: 'Montana', code: 'MT', slug: 'montana', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre', 'Anaconda', 'Miles City'] },
  'NE': { name: 'Nebraska', code: 'NE', slug: 'nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'Norfolk', 'North Platte', 'Columbus', 'Papillion', 'La Vista', 'Scottsbluff', 'South Sioux City', 'Beatrice'] },
  'NV': { name: 'Nevada', code: 'NV', slug: 'nevada', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko', 'Mesquite', 'Boulder City'] },
  'NH': { name: 'New Hampshire', code: 'NH', slug: 'new-hampshire', cities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover', 'Rochester', 'Salem', 'Merrimack', 'Hudson', 'Londonderry'] },
  'NJ': { name: 'New Jersey', code: 'NJ', slug: 'new-jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge', 'Lakewood', 'Toms River', 'Hamilton', 'Trenton', 'Clifton', 'Camden', 'Brick', 'Cherry Hill', 'Passaic', 'Union City', 'Old Bridge', 'Middletown', 'Gloucester Township', 'East Orange'] },
  'NM': { name: 'New Mexico', code: 'NM', slug: 'new-mexico', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo', 'Carlsbad'] },
  'NY': { name: 'New York', code: 'NY', slug: 'new-york', cities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Hempstead', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport', 'Valley Stream', 'Long Beach', 'Spring Valley', 'Rome'] },
  'NC': { name: 'North Carolina', code: 'NC', slug: 'north-carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord', 'Greenville', 'Asheville', 'Gastonia', 'Jacksonville', 'Chapel Hill', 'Huntersville', 'Apex', 'Hickory', 'Wake Forest', 'Indian Trail'] },
  'ND': { name: 'North Dakota', code: 'ND', slug: 'north-dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Dickinson', 'Mandan', 'Jamestown', 'Wahpeton'] },
  'OH': { name: 'Ohio', code: 'OH', slug: 'ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain', 'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Euclid', 'Dublin', 'Middletown', 'Newark'] },
  'OK': { name: 'Oklahoma', code: 'OK', slug: 'oklahoma', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton', 'Moore', 'Midwest City', 'Enid', 'Stillwater', 'Muskogee', 'Bartlesville', 'Owasso', 'Shawnee', 'Ponca City'] },
  'OR': { name: 'Oregon', code: 'OR', slug: 'oregon', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Albany', 'Tigard', 'Lake Oswego', 'Keizer', 'Grants Pass'] },
  'PA': { name: 'Pennsylvania', code: 'PA', slug: 'pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona', 'Erie', 'York', 'Wilkes-Barre', 'Chester', 'Williamsport', 'Easton', 'Lebanon', 'Hazleton', 'New Castle', 'Johnstown', 'McKeesport'] },
  'RI': { name: 'Rhode Island', code: 'RI', slug: 'rhode-island', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Newport', 'Central Falls', 'Westerly', 'North Providence'] },
  'SC': { name: 'South Carolina', code: 'SC', slug: 'south-carolina', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Goose Creek', 'Sumter', 'Hilton Head Island', 'Florence', 'Spartanburg', 'Myrtle Beach', 'Aiken', 'Anderson'] },
  'SD': { name: 'South Dakota', code: 'SD', slug: 'south-dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Pierre', 'Huron', 'Vermillion'] },
  'TN': { name: 'Tennessee', code: 'TN', slug: 'tennessee', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett', 'Hendersonville', 'Kingsport', 'Collierville', 'Smyrna', 'Cleveland', 'Brentwood', 'Germantown', 'Columbia', 'La Vergne', 'Gallatin'] },
  'TX': { name: 'Texas', code: 'TX', slug: 'texas', cities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'Brownsville', 'McKinney', 'Frisco', 'Pasadena', 'Mesquite', 'Killeen', 'McAllen', 'Waco', 'Denton', 'Carrollton', 'Midland', 'Pearland', 'Lewisville', 'Abilene', 'College Station', 'Round Rock', 'Richardson', 'League City', 'Odessa', 'Sugar Land', 'Beaumont', 'The Woodlands', 'Allen', 'Tyler', 'Wichita Falls', 'San Angelo', 'Edinburg', 'Conroe', 'New Braunfels', 'Bryan', 'Mission', 'Longview', 'Pharr', 'Flower Mound', 'Baytown'] },
  'UT': { name: 'Utah', code: 'UT', slug: 'utah', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'South Jordan', 'Lehi', 'Millcreek', 'Taylorsville', 'Logan', 'Murray'] },
  'VT': { name: 'Vermont', code: 'VT', slug: 'vermont', cities: ['Burlington', 'South Burlington', 'Rutland', 'Essex Junction', 'Barre', 'Montpelier', 'Winooski', 'St. Albans', 'Newport', 'Vergennes'] },
  'VA': { name: 'Virginia', code: 'VA', slug: 'virginia', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk', 'Lynchburg', 'Harrisonburg', 'Leesburg', 'Charlottesville', 'Danville', 'Manassas', 'Petersburg', 'Fredericksburg', 'Winchester', 'Salem'] },
  'WA': { name: 'Washington', code: 'WA', slug: 'washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Spokane Valley', 'Federal Way', 'Yakima', 'Bellingham', 'Kirkland', 'Kennewick', 'Auburn', 'Pasco', 'Marysville', 'Lakewood', 'Redmond', 'Sammamish'] },
  'WV': { name: 'West Virginia', code: 'WV', slug: 'west-virginia', cities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling', 'Weirton', 'Fairmont', 'Martinsburg', 'Beckley', 'Clarksburg'] },
  'WI': { name: 'Wisconsin', code: 'WI', slug: 'wisconsin', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Eau Claire', 'Oshkosh', 'Janesville', 'West Allis', 'La Crosse', 'Sheboygan', 'Wauwatosa', 'Fond du Lac', 'New Berlin', 'Brookfield', 'Greenfield', 'Beloit', 'Menomonee Falls'] },
  'WY': { name: 'Wyoming', code: 'WY', slug: 'wyoming', cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Cody'] },
  'DC': { name: 'Washington D.C.', code: 'DC', slug: 'washington-dc', cities: ['Washington'] }
}

// Generate slug from city name
export function generateCitySlug(cityName: string): string {
  return cityName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Get all cities as flat array with full data
export function getAllCities(): CityData[] {
  const cities: CityData[] = []

  for (const [stateCode, stateData] of Object.entries(STATE_DATA)) {
    for (const cityName of stateData.cities) {
      cities.push({
        name: cityName,
        state: stateData.name,
        stateCode: stateCode,
        slug: generateCitySlug(cityName),
        isCapital: stateData.cities.indexOf(cityName) === 0 // First city is often capital/largest
      })
    }
  }

  return cities
}

// Get all states as flat array
export function getAllStates(): StateData[] {
  return Object.values(STATE_DATA)
}

// Lookup location by slug (city or state)
export function lookupLocationBySlug(slug: string): { type: 'city' | 'state', data: CityData | StateData } | null {
  // Check if it's a state
  for (const stateData of Object.values(STATE_DATA)) {
    if (stateData.slug === slug) {
      return { type: 'state', data: stateData }
    }
  }

  // Check if it's a city
  for (const [stateCode, stateData] of Object.entries(STATE_DATA)) {
    for (const cityName of stateData.cities) {
      const citySlug = generateCitySlug(cityName)
      if (citySlug === slug) {
        return {
          type: 'city',
          data: {
            name: cityName,
            state: stateData.name,
            stateCode: stateCode,
            slug: citySlug
          }
        }
      }
    }
  }

  return null
}

// Get nearby cities in the same state
export function getNearbyCities(stateCode: string, excludeCity?: string, limit: number = 10): CityData[] {
  const stateData = STATE_DATA[stateCode]
  if (!stateData) return []

  return stateData.cities
    .filter(city => city !== excludeCity)
    .slice(0, limit)
    .map(cityName => ({
      name: cityName,
      state: stateData.name,
      stateCode: stateCode,
      slug: generateCitySlug(cityName)
    }))
}

// Get all valid slugs for static generation
export function getAllLocationSlugs(): string[] {
  const slugs: string[] = []

  // Add state slugs
  for (const stateData of Object.values(STATE_DATA)) {
    slugs.push(stateData.slug)
  }

  // Add city slugs
  for (const stateData of Object.values(STATE_DATA)) {
    for (const cityName of stateData.cities) {
      slugs.push(generateCitySlug(cityName))
    }
  }

  return slugs
}

// Total count of locations
export function getTotalLocationCount(): number {
  let count = Object.keys(STATE_DATA).length // States
  for (const stateData of Object.values(STATE_DATA)) {
    count += stateData.cities.length // Cities
  }
  return count
}
