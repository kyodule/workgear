import { client } from '../db/index.js'
import { runBootstrapSeed } from './seed-bootstrap.js'
import { runAgentRolesSeed } from './seed-agent-roles.js'
import { runTemplatesSeed } from './seed-templates.js'

async function seedAll() {
  console.log('🚀 Running all seeds...\n')

  try {
    await runBootstrapSeed()
    console.log()
    
    await runAgentRolesSeed()
    console.log()
    
    await runTemplatesSeed()
    
    console.log('\n🎉 All seeds completed!')
  } catch (error) {
    console.error('❌ Seed failed:', error)
    throw error
  } finally {
    await client.end()
  }
}

seedAll().catch(() => {
  process.exit(1)
})
