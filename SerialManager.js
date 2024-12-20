import { SerialPort } from "serialport";
import { ReadlineParser } from '@serialport/parser-readline'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let waitingForResponse = false;
let serialResponse = "";

export default class SerialManager {

    #properties;
    #serialPort;
    #serialPortParser;
    #kill = false;

    constructor(properties){
        this.#properties = properties;
    }

    async initialize(){
        const serialPort = this.#properties.get("general.port");
        return new Promise((resolve, reject) => {
            this.#serialPort = new SerialPort({path: serialPort, baudRate: 9600 }, (err) => {
                if(err) reject(err);
            });

            this.#serialPortParser = this.#serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

            this.#serialPort.on("open", async ()=> {
                console.log(`Connected to ${serialPort}`);
                
                this.#serialPortParser.on('data', this.#onData);
                
                await delay(2000);
                resolve(true);
            });
        });
    }

    async #onData(data){
        serialResponse = data;
        waitingForResponse = false;
    }

    async getSerialPorts(){
        let portPaths = [];
        return new Promise((resolve, reject) => {
            SerialPort.list().then((ports) => {
                ports.forEach((port) => {
                    portPaths.push(port.path);
                });

                resolve(portPaths);
            });
        });
    }

    async closeSerialPort(){
        return new Promise((resolve, reject) => {
            this.#serialPort.close((err) => {
                if(err) reject(err);

                resolve(true);
            });
        });
    }

    async syncWriteData(data){
        return new Promise(async (resolve, reject) => {
            try{
                if(waitingForResponse) this.#kill = true;
                waitingForResponse = true;
                delay(1000);
                await this.writeData(data);
            }catch(err){
                console.error(err);
                waitingForResponse = false;
                reject(err);
                return;
            }

            console.log("Waiting for response from serial port...");
            while(waitingForResponse){
                if(this.#kill){
                    this.#kill = false;
                    console.error("Force killed waiting for response!");
                    reject("killed");
                    break;
                }
                await delay(1000);
            }

            console.log("Received data from serial port!");
            resolve(serialResponse);
        });
    }

    async writeData(data){
        return new Promise((resolve, reject) => {
            this.#serialPort.write(data + "\n", (err) => {
                if(err) reject(err);
                console.log("Sent data to serial port!");
                resolve(data);
            })
        });
    }
}