import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface AnalysisResult {
  apiRoutes: {
    deprecated: string[];
    duplicate: string[];
    unused: string[];
    testOnly: string[];
  };
  collections: {
    legacy: string[];
    duplicate: string[];
    temporary: string[];
  };
  scripts: {
    unused: string[];
    oneTime: string[];
  };
  components: {
    unused: string[];
    deprecated: string[];
  };
}

async function analyzeCodebase() {
  console.log('🔍 COMPREHENSIVE CODEBASE ANALYSIS FOR CLEANUP');
  console.log('=' .repeat(60) + '\n');
  
  const results: AnalysisResult = {
    apiRoutes: { deprecated: [], duplicate: [], unused: [], testOnly: [] },
    collections: { legacy: [], duplicate: [], temporary: [] },
    scripts: { unused: [], oneTime: [] },
    components: { unused: [], deprecated: [] }
  };
  
  // 1. Analyze API Routes
  console.log('1️⃣ ANALYZING API ROUTES\n');
  
  try {
    // Find all API routes
    const { stdout: apiFiles } = await execAsync('find src/app/api -type f -name "*.ts" 2>/dev/null');
    const apiRoutes = apiFiles.trim().split('\n').filter(Boolean);
    
    console.log(`Found ${apiRoutes.length} API routes\n`);
    
    // Categorize API routes
    for (const route of apiRoutes) {
      const fileName = path.basename(route);
      const dirName = path.dirname(route);
      
      // Test/Debug routes
      if (dirName.includes('/test/') || fileName.includes('test')) {
        results.apiRoutes.testOnly.push(route);
      }
      
      // Deprecated patterns
      if (route.includes('-old') || route.includes('deprecated') || route.includes('legacy')) {
        results.apiRoutes.deprecated.push(route);
      }
      
      // Migration/temporary routes
      if (route.includes('migration') || route.includes('temp') || route.includes('cleanup')) {
        results.apiRoutes.deprecated.push(route);
      }
      
      // Duplicate video/property endpoints
      if (route.includes('property/video-cron') || route.includes('process-video')) {
        results.apiRoutes.duplicate.push(route);
      }
      
      // Old scraper versions
      if (route.includes('scraper') && !route.includes('v2') && !route.includes('scraper-v2')) {
        results.apiRoutes.deprecated.push(route);
      }
      
      // Auth cleanup routes
      if (route.includes('cleanup-old-account')) {
        results.apiRoutes.deprecated.push(route);
      }
      
      // Old upload endpoints
      if (route.includes('upload-properties') && !route.includes('v4')) {
        results.apiRoutes.deprecated.push(route);
      }
    }
    
    // 2. Check for unused imports/exports
    console.log('\n2️⃣ CHECKING FOR UNUSED CODE PATTERNS\n');
    
    const { stdout: unusedImports } = await execAsync(`grep -r "// @ts-ignore\\|// eslint-disable\\|// TODO\\|// FIXME\\|// DEPRECATED" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l`);
    console.log(`Found ${unusedImports.trim()} code smell comments\n`);
    
    // 3. Find duplicate function patterns
    console.log('3️⃣ FINDING DUPLICATE PATTERNS\n');
    
    // Check for multiple queue systems
    const { stdout: queueSystems } = await execAsync(`find src -name "*queue*.ts" -o -name "*Queue*.tsx" 2>/dev/null | wc -l`);
    console.log(`Found ${queueSystems.trim()} queue-related files\n`);
    
    // Check for multiple video processing systems
    const { stdout: videoSystems } = await execAsync(`grep -r "process.*video\\|video.*process" src --include="*.ts" 2>/dev/null | wc -l`);
    console.log(`Found ${videoSystems.trim()} video processing references\n`);
    
    // 4. Analyze scripts
    console.log('4️⃣ ANALYZING SCRIPTS FOLDER\n');
    
    const scriptsDir = 'scripts';
    if (fs.existsSync(scriptsDir)) {
      const scripts = fs.readdirSync(scriptsDir);
      
      for (const script of scripts) {
        if (script.includes('test') || script.includes('check') || script.includes('fix')) {
          results.scripts.oneTime.push(script);
        }
        if (script.includes('old') || script.includes('backup') || script.includes('migration')) {
          results.scripts.unused.push(script);
        }
      }
    }
    
    // 5. Components analysis
    console.log('5️⃣ ANALYZING COMPONENTS\n');
    
    const { stdout: componentFiles } = await execAsync('find src/components -type f -name "*.tsx" 2>/dev/null | wc -l');
    console.log(`Found ${componentFiles.trim()} component files\n`);
    
    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📋 CLEANUP RECOMMENDATIONS');
    console.log('='.repeat(60) + '\n');
    
    console.log('🗑️ API ROUTES TO REMOVE:\n');
    
    if (results.apiRoutes.testOnly.length > 0) {
      console.log('Test/Debug Routes:');
      results.apiRoutes.testOnly.forEach(r => console.log(`  - ${r}`));
    }
    
    if (results.apiRoutes.deprecated.length > 0) {
      console.log('\nDeprecated/Migration Routes:');
      results.apiRoutes.deprecated.forEach(r => console.log(`  - ${r}`));
    }
    
    if (results.apiRoutes.duplicate.length > 0) {
      console.log('\nDuplicate Functionality:');
      results.apiRoutes.duplicate.forEach(r => console.log(`  - ${r}`));
    }
    
    console.log('\n🗑️ SCRIPTS TO REMOVE:\n');
    
    if (results.scripts.oneTime.length > 0) {
      console.log('One-time/Test Scripts:');
      results.scripts.oneTime.forEach(s => console.log(`  - scripts/${s}`));
    }
    
    if (results.scripts.unused.length > 0) {
      console.log('\nOld/Backup Scripts:');
      results.scripts.unused.forEach(s => console.log(`  - scripts/${s}`));
    }
    
    // Estimate storage savings
    let totalFiles = results.apiRoutes.testOnly.length + 
                     results.apiRoutes.deprecated.length + 
                     results.apiRoutes.duplicate.length +
                     results.scripts.oneTime.length +
                     results.scripts.unused.length;
    
    console.log('\n📊 POTENTIAL CLEANUP IMPACT:');
    console.log(`  Files to remove: ${totalFiles}`);
    console.log(`  Estimated code reduction: ~${totalFiles * 5}KB`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeCodebase().catch(console.error);