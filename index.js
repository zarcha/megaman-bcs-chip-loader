import fs from 'fs';
import readline from 'readline';
import propertiesReader from 'properties-reader';
import SerialManager from './SerialManager.js';
import { resolve } from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const properties = propertiesReader("app.properties");
const serialManager = new SerialManager(properties);

const BCSNaviFile = properties.get("general.BCSNavi");
const BCSChipsFile = properties.get("general.BCSChips");

const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

while(true){
    await askForOption();
}

async function askForOption(){
    return new Promise(async (resolve, rejects) => {
        const option = await displayPrompt("(1) Navi (2) Load Chip (3) Quit: ");
        switch(option){
            case 1:
                await naviPrompts();
                break;
            case 2:
                console.error("Single Player only supported!");
                await delay(3000);
                let chips = await chipPrompt();
                fs.writeFileSync(BCSChipsFile, chips + "00".repeat(6), {encoding: 'hex'});
                break;
            case 3:
                console.log("Thank you for using my application!");
                process.exit(0);
            default:
                console.error("No valid option selected!");
        }
    
        resolve(true);
    });
}

async function naviPrompts(){
    return new Promise(async (resolve, reject) => {
        let data;

        const option = await displayPrompt("(1) Load Navi from chip (2) Load Navi from file (3) Save Navi (4) Unload Navi (5) Back: ");
        switch(option){
            case 1:
                await serialManager.initialize();
                data = await serialManager.syncWriteData("0");
                serialManager.closeSerialPort();
                fs.writeFileSync(BCSNaviFile, 'F81F' + data, {encoding: 'hex'});
                console.log("Navi loaded!");
                console.log("Creating Navi backup...");
                fs.writeFileSync("./backup.bin", data, {encoding: 'hex'});
                console.log("Created Navi backup!")
                break;
            case 2:
                let id = await displayPrompt("(1) Enter Navi ID (2) Back: ");
                data = fs.readFileSync(properties.get(`NAVI.${id}`), {encoding: 'hex'});
                fs.writeFileSync(BCSNaviFile, 'F81F' + data, {encoding: 'hex'});
                console.log("Navi loaded!");
                break;
            case 3:
                console.error("Saving Navi chip is not supported yet!");
                data = fs.readFileSync(BCSNaviFile, {encoding: 'hex'});
                data = data.substring(2);
                serialManager.initialize();
                for(let i = 0; i < 1024; i++){
                    let bytes = `1:${i} ${data.substring(i * 2, (i * 2) + 2)}`;

                    if(i == 1023){
                        await serialManager.syncWriteData(bytes);
                    }else{
                        serialManager.writeData(bytes);
                        await delay(100);
                    }
                }
                serialManager.closeSerialPort();
                // console.log(data);
                await delay("10000")
                break;
            case 4:
                fs.writeFileSync(BCSNaviFile, 'FFFF' + 'F'.repeat(2048));
                console.log("Navi Unloaded!");
        }

        resolve(true);
    });
}

async function chipPrompt(){
    return new Promise(async (resolve, reject) => {
        let chips = "";

        await serialManager.initialize();

        for(let i = 0; i < 3; i++){
            let option = await displayPrompt(`(1) Load chip ${i + 1} (2) Skip: `);

            if(option == 1){
                const pinout = await serialManager.syncWriteData("2");
                const bin = getChipBinValue(pinout);
                chips += bin2hex(bin.substr(8, 16));
                chips += bin2hex(bin.substr(0, 7));
            }else{
                chips += "0000"
            }
        }

        serialManager.closeSerialPort();
        resolve(chips);
    });
}

async function displayPrompt(question){
    return new Promise((resolve, reject) => {
        console.clear();

        prompt.question(question, (option) => {
            resolve(parseInt(option));
        });
    });
}

function getChipBinValue(pinout){
    return pinout.substr(2).slice(0, -1).split("").reverse().join("").padStart(16, '0');
}

function bin2hex(bin){
    return ("00" + (parseInt(bin, 2)).toString(16)).substr(-2)
}