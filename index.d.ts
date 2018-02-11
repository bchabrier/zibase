// Type definitions for request
// Project: https://github.com/request/request
// Definitions by: Carlos Ballesteros Velasco <https://github.com/soywiz>, bonnici <https://github.com/bonnici>, Bart van der Schoor <https://github.com/Bartvds>, Joe Skeen <http://github.com/joeskeen>, Christopher Currens <https://github.com/ccurrens>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// Imported from: https://github.com/soywiz/typescript-node-definitions/d.ts

/// <!reference types="express" />

declare namespace zibase {

    //export class Response {}

    export enum ZbProtocol {
        PRESET = 0,
        VISONIC433 = 1,
        VISONIC868 = 2,
        CHACON = 3,
        DOMIA = 4,
        X10 = 5,
        ZWAVE = 6,
        RFS10 = 7,
        X2D433 = 8,
        X2D433ALRM = 8,
        X2D868 = 9,
        X2D868ALRM = 9,
        X2D868INSH = 10,
        X2D868PIWI = 11,
        X2D868BOAC = 12,
    }

    export enum ZbAction {
        OFF = 0,
        ON = 1,
        DIM_BRIGHT = 2,
        ALL_LIGHTS_ON = 4,
        ALL_LIGHTS_OFF = 5,
        ALL_OFF = 6,
        ASSOC = 7,
    } 

    export class ZbRequest {

    }

    export class ZbResponse {
        header?: string;
        command?: string;
        reserved1?: string;
        zibaseId?: string;
        param1?: number;
        param2?: number;
        param3?: number;
        param4?: number;
        myCount?: number;
        yourCount?: number;
        message?: string;
    }

    export class ZiBase {
        constructor(ipAddr: string, deviceId: string, token: string, callback?: (err: Error) => void);

        //emitEvent(event: string, arg1: any, arg2: any): void;

        loadDescriptors(callback: (err: Error) => void): void;
        getDescriptor(id: string): { id: string, type: string };

        on(event: string, callback: Function): void;
        on(event: string, id: string, callback: Function): void;
        once(event: string, callback: Function): void;
        once(event: string, id: string, callback: Function): void;

        processZiBaseData(response: ZbResponse): void;
        listenToZiBase(processDataMethod: (response: ZbResponse) => void): void;

        protected sendRequest(request: ZbRequest, withResponse: boolean, callback: (err: Error, response: ZbResponse) => void): void;
        sendCommand(address: string, action: ZbAction, protocol?: ZbProtocol, dimLevel?: number, nbBurst?: number): void;
        runScenario(num: number|string): boolean;
        setEvent(action: ZbAction, address: string): void;
        getVariable(numVar: number, callback: (err: Error, value: string) => void): void;
        getState(address: string, callback: (err: Error, value: string) => void): void;
        getSensorInfo(idSensor: string, callback: (err: Error, value: { date: Date, v1: string, v2: string }) => void): void;
        executeRemote(id: string, action: ZbAction): void;

        registerListener(port: number): void;
        deregisterListener(): void;

    }
}

export = zibase;
