const { randomInt } = require("crypto");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


async function run() {
  try {
    console.log('Start tasks...');
    await sleep(10000);
  
    let random = randomInt(1, 100);
  
    if (random >= 50) {
      console.log(random);
      console.log('Success');
      process.exit(0);
    } else {  
      console.log(random);
      throw new Error('Failed');
    }
    
  } catch (error) {
    console.error(error)
    process.exit(1);
  }
}

void run().catch(console.error);