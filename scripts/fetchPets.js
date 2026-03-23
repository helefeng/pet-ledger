// 爬虫脚本：从赛尔号官网爬取精灵信息
// 使用方法：node scripts/fetchPets.js
// 说明：此脚本会爬取指定范围的精灵信息，可根据需要调整 startId 和 endId

import https from 'https';
import fs from 'fs';

// 爬取单个精灵的信息
function fetchPetInfo(petId) {
  return new Promise((resolve, reject) => {
    const url = `https://seer.61.com/main/spirit/${petId}.html`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // 从HTML中提取精灵名字
          // 查找 <th colspan="2">精灵名字</th> 的模式
          const match = data.match(/<th\s+colspan="2">([^<]+)<\/th>/);
          const name = match ? match[1].trim() : null;
          
          if (name) {
            resolve({
              id: petId,
              name: name,
              imageUrl: `http://seerh5.61.com/resource/assets/fightResource/pet/${petId}.png`
            });
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    }).on('error', (error) => {
      resolve(null);
    });
  });
}

// 批量爬取精灵信息
async function fetchAllPets(startId = 1, endId = 500) {
  const pets = [];
  
  console.log(`开始爬取精灵信息 (ID: ${startId}-${endId})...`);
  console.log('这可能需要几分钟，请耐心等待...\n');
  
  for (let i = startId; i <= endId; i++) {
    if (i % 10 === 0) {
      console.log(`进度: ${i}/${endId}`);
    }
    
    const petInfo = await fetchPetInfo(i);
    
    if (petInfo) {
      pets.push(petInfo);
    }
    
    // 延迟以避免请求过快
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return pets;
}

// 主函数
async function main() {
  try {
    // 爬取精灵 ID 1-500
    // 如需更新范围，修改下面的参数即可
    // 例如：fetchAllPets(1, 1000) 会爬取 1-1000
    const pets = await fetchAllPets(1, 500);
    
    // 生成 TypeScript 代码
    const tsCode = `// 自动生成的精灵数据库
// 生成时间: ${new Date().toISOString()}
// 包含精灵数: ${pets.length}

export interface PetInfo {
  id: number
  name: string
  imageUrl: string
}

export const PETS_DATABASE: PetInfo[] = [
${pets.map(p => `  { id: ${p.id}, name: '${p.name}', imageUrl: '${p.imageUrl}' }`).join(',\n')}
]

// 根据精灵ID获取图片URL
export const getPetImageUrl = (petId: number): string => {
  return \`http://seerh5.61.com/resource/assets/fightResource/pet/\${petId}.png\`
}

// 根据精灵ID获取精灵名称
export const getPetName = (petId: number): string => {
  const pet = PETS_DATABASE.find(p => p.id === petId)
  return pet?.name || \`精灵\${petId}\`
}

// 根据精灵名称获取精灵ID
export const getPetId = (petName: string): number | undefined => {
  const pet = PETS_DATABASE.find(p => p.name === petName)
  return pet?.id
}

// 获取所有精灵名称列表
export const getPetNamesList = (): string[] => {
  return PETS_DATABASE.map(p => p.name)
}
`;
    
    // 保存到文件
    fs.writeFileSync('src/constants/petDatabase.ts', tsCode);
    console.log(`\n✓ 成功生成 ${pets.length} 个精灵的数据库`);
    console.log('文件已保存到: src/constants/petDatabase.ts');
    console.log('\n提示：如需更新精灵范围，修改 fetchAllPets() 的参数即可');
    
  } catch (error) {
    console.error('爬取失败:', error);
  }
}

main();
