const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
    console.log('Usage: npm run hash YOUR_PASSWORD');
    process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
    console.log('');
    console.log('Generated hash:');
    console.log(hash);
    console.log('');
    console.log('Add to your .env file as:');
    console.log(`ADMIN_PASS_HASH=${hash}`);
    console.log('');
});
