// Copyright (C) 2022 MCSManager <mcsmanager-dev@outlook.com>

import { io, Socket, SocketOptions, ManagerOptions } from "socket.io-client";
import { RemoteServiceConfig } from "./entity_interface";
import { logger } from "../service/log";
import RemoteRequest from "../service/remote_command";
import InstanceStreamListener from "../common/instance_stream";
import { $t, i18next } from "../i18n";

export default class RemoteService {
  public static readonly STATUS_OK = 200;
  public static readonly STATUS_ERR = 500;

  public uuid: string = null;
  public available: boolean = false;
  public socket: Socket = null;
  public readonly instanceStream = new InstanceStreamListener();
  public config: RemoteServiceConfig;

  constructor(uuid: string, config: RemoteServiceConfig) {
    this.uuid = uuid;
    this.config = config;
  }

  public connect(connectOpts?: Partial<SocketOptions & ManagerOptions>) {
    if (connectOpts) this.config.connectOpts = connectOpts;
    // Start the formal connection to the remote Socket program
    let addr = `ws://${this.config.ip}:${this.config.port}`;
    if (this.config.ip.indexOf("wss://") === 0 || this.config.ip.indexOf("ws://") === 0) {
      addr = `${this.config.ip}:${this.config.port}`;
    }
    const daemonInfo = `[${this.uuid}] [${addr}/${this.config.remarks}]`;

    if (this.available) {
      logger.info(`${$t("daemonInfo.resetConnect")}:${daemonInfo}`);
      this.disconnect();
    }

    // prevent duplicate registration of events
    if (this.socket && this.socket.hasListeners("connect")) {
      logger.info(`${$t("daemonInfo.replaceConnect")}:${daemonInfo}`);
      return this.refreshReconnect();
    }

    logger.info(`${$t("daemonInfo.tryConnect")}:${daemonInfo}`);
    this.socket = io(addr, this.config.connectOpts);

    // register built-in events
    this.socket.on("connect", async () => {
      logger.info($t("daemonInfo.connect", { v: daemonInfo }));
      await this.onConnect();
    });
    this.socket.on("disconnect", async () => {
      logger.info($t("daemonInfo.disconnect", { v: daemonInfo }));
      await this.onDisconnect();
    });
    this.socket.on("connect_error", async (error: string) => {
      await this.onDisconnect();
    });
  }

  public async setLanguage(language?: string) {
    if (!language) language = i18next.language;
    logger.info(
      `${$t("daemonInfo.setLanguage")} (${this.config.ip}:${this.config.port}/${
        this.config.remarks
      }) language: ${language}`
    );
    return await new RemoteRequest(this).request("info/setting", {
      language
    });
  }

  // This function is used to verify the identity. It only needs to be verified once.
  // This function will be executed automatically after the connection event is triggered.
  // Generally, there is no need to execute it manually.
  public async auth(key?: string) {
    if (key) this.config.apiKey = key;
    const daemonInfo = `[${this.uuid}] [${this.config.ip}:${this.config.port}]`;
    try {
      const res = await new RemoteRequest(this).request("auth", this.config.apiKey, 5000, true);
      if (res === true) {
        this.available = true;
        await this.setLanguage();
        logger.info($t("daemonInfo.authSuccess", { v: daemonInfo }));
        return true;
      }
      this.available = false;
      logger.warn($t("daemonInfo.authFailure", { v: daemonInfo }));
      return false;
    } catch (error) {
      logger.warn($t("daemonInfo.authError", { v: daemonInfo }));
      logger.warn(error);
      return false;
    }
  }

  public emit(event: string, data?: any) {
    return this.socket.emit(event, data);
  }

  private async onDisconnect() {
    this.available = false;
  }

  private async onConnect() {
    // this.available = true; Note: Connected is not auth;
    return await this.auth(this.config.apiKey);
  }

  disconnect() {
    if (this.socket) {
      const daemonInfo = `[${this.uuid}] [${this.config.ip}:${this.config.port}]`;
      logger.info($t("daemonInfo.closed", { v: daemonInfo }));
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket.close();
      delete this.socket;
    }
    this.socket = null;
    this.available = false;
  }

  refreshReconnect() {
    this.disconnect();
    this.connect();
  }
}
