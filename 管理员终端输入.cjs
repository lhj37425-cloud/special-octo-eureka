const readline=require('readline');

function ask(prompt,{hidden=false}={}){
  return new Promise(resolve=>{
    const rl=readline.createInterface({input:process.stdin,output:process.stdout});
    if(!hidden||!process.stdin.isTTY){rl.question(prompt,value=>{rl.close();resolve(value)});return}
    process.stdout.write(prompt);
    let value='';
    const finish=()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.removeListener('data',onData);process.stdout.write('\n');rl.close();resolve(value)};
    const onData=chunk=>{const key=chunk.toString();if(key==='\r'||key==='\n')return finish();if(key==='\u0003'){process.exitCode=1;return finish()}if(key==='\u0008'||key==='\u007f'){value=value.slice(0,-1);return}value+=key};
    process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);
  });
}
module.exports={ask};
