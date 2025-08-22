import https from 'https';

const SUPABASE_URL = 'https://wteqgprgiylmxzszcnws.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI';

// 获取表结构信息
async function getTableStructure() {
  const options = {
    hostname: 'wteqgprgiylmxzszcnws.supabase.co',
    port: 443,
    path: '/rest/v1/',
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// 获取枚举值
async function getEnumValues() {
  const options = {
    hostname: 'wteqgprgiylmxzszcnws.supabase.co',
    port: 443,
    path: '/rest/v1/rpc/get_enum_values',
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({}));
    req.end();
  });
}

// 获取数据源字段
async function getDataSourceFields() {
  const options = {
    hostname: 'wteqgprgiylmxzszcnws.supabase.co',
    port: 443,
    path: '/rest/v1/rpc/get_data_source_fields',
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({}));
    req.end();
  });
}

// 主函数
async function main() {
  try {
    console.log('正在获取数据库结构信息...');
    
    const tableStructure = await getTableStructure();
    console.log('表结构信息:');
    console.log(JSON.stringify(tableStructure, null, 2));
    
    console.log('\n正在获取枚举值...');
    try {
      const enums = await getEnumValues();
      console.log('枚举值:');
      console.log(JSON.stringify(enums, null, 2));
    } catch (error) {
      console.log('获取枚举值失败:', error.message);
    }
    
    console.log('\n正在获取数据源字段...');
    try {
      const dataSourceFields = await getDataSourceFields();
      console.log('数据源字段:');
      console.log(JSON.stringify(dataSourceFields, null, 2));
    } catch (error) {
      console.log('获取数据源字段失败:', error.message);
    }
    
  } catch (error) {
    console.error('错误:', error);
  }
}

main();
