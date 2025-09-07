// Test script to verify properties show for buyers with different cities and radiuses

const testBuyers = [
  {
    name: 'Michael Johnson',
    city: 'Dallas',
    state: 'TX',
    radius: 10,
    maxMonthly: 2500,
    maxDown: 15000,
    expectedCities: ['Dallas', 'Irving', 'University Park', 'Highland Park']
  },
  {
    name: 'Sarah Williams',
    city: 'Irving',
    state: 'TX',
    radius: 15,
    maxMonthly: 2000,
    maxDown: 10000,
    expectedCities: ['Irving', 'Dallas', 'Richardson', 'Farmers Branch', 'Addison', 'Carrollton', 'Garland', 'Mesquite']
  },
  {
    name: 'James Brown',
    city: 'Arlington',
    state: 'TX',
    radius: 20,
    maxMonthly: 3000,
    maxDown: 20000,
    expectedCities: ['Arlington', 'Grand Prairie', 'Dallas', 'Fort Worth', 'Irving']
  },
  {
    name: 'Emily Davis',
    city: 'Houston',
    state: 'TX',
    radius: 25,
    maxMonthly: 2800,
    maxDown: 18000,
    expectedCities: ['Houston', 'Pasadena', 'Sugar Land', 'Pearland', 'Missouri City', 'Bellaire', 'Spring', 'Cypress']
  },
  {
    name: 'Robert Martinez',
    city: 'Miami',
    state: 'FL',
    radius: 15,
    maxMonthly: 3500,
    maxDown: 25000,
    expectedCities: ['Miami', 'Miami Beach', 'Coral Gables', 'Hialeah', 'Doral', 'Kendall', 'North Miami', 'North Miami Beach']
  }
];

async function testPropertyMatching() {
  console.log('Testing property matching for different buyers...\n');
  console.log('='.repeat(80));
  
  for (const buyer of testBuyers) {
    const url = `http://localhost:3001/api/buyer/matched-properties?city=${encodeURIComponent(buyer.city)}&state=${buyer.state}&radius=${buyer.radius}&maxMonthly=${buyer.maxMonthly}&maxDown=${buyer.maxDown}`;
    
    console.log(`\n${buyer.name} - ${buyer.city}, ${buyer.state} (${buyer.radius} mi radius)`);
    console.log(`Budget: $${buyer.maxMonthly}/mo, $${buyer.maxDown} down`);
    console.log('-'.repeat(40));
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`ERROR: ${data.error}`);
        continue;
      }
      
      console.log(`Cities being searched: ${data.summary?.searchCities?.join(', ') || 'Not available'}`);
      console.log(`Total properties found: ${data.properties?.length || 0}`);
      
      if (data.properties && data.properties.length > 0) {
        // Group properties by city
        const propertiesByCity = {};
        data.properties.forEach(prop => {
          const city = prop.city || 'Unknown';
          if (!propertiesByCity[city]) {
            propertiesByCity[city] = [];
          }
          propertiesByCity[city].push(prop);
        });
        
        console.log('\nProperties by city:');
        Object.entries(propertiesByCity).forEach(([city, props]) => {
          console.log(`  ${city}: ${props.length} properties`);
          props.slice(0, 2).forEach(prop => {
            console.log(`    - ${prop.address} ($${prop.monthlyPayment}/mo)`);
          });
        });
      } else {
        console.log('No properties found matching criteria');
      }
      
    } catch (error) {
      console.log(`ERROR: Failed to fetch - ${error.message}`);
    }
    
    console.log('='.repeat(80));
  }
}

testPropertyMatching();