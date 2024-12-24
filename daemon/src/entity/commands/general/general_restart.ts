import { $t } from "../../../i18n";
import Instance from "../../instance/instance";
import InstanceCommand from "../base/command";

export default class GeneralRestartCommand extends InstanceCommand {
  constructor() {
    super("GeneralRestartCommand");
  }

  async exec(instance: Instance) {
    // If the automatic restart function is enabled, the setting is ignored once
    if (instance.config.eventTask && instance.config.eventTask.autoRestart)
      instance.config.eventTask.ignore = true;

    try {
      instance.println("INFO", $t("TXT_CODE_restart.start"));
      instance.setLock(true);
      await instance.execPreset("stop");
      const startCount = instance.startCount;
      // Check the instance status every second,
      // if the instance status is stopped, restart the server immediately
      const task = setInterval(async () => {
        try {
          if (startCount !== instance.startCount) {
            throw new Error($t("TXT_CODE_restart.error1"));
          }
          if (
            instance.status() !== Instance.STATUS_STOPPING &&
            instance.status() !== Instance.STATUS_STOP
          ) {
            throw new Error($t("TXT_CODE_restart.error2"));
          }
          if (instance.status() === Instance.STATUS_STOP) {
            instance.println("INFO", $t("TXT_CODE_restart.restarting"));
            instance.setLock(false);
            clearInterval(task);
            await instance.execPreset("start");
          }
        } catch (error: any) {
          clearInterval(task);
          instance.setLock(false);
          instance.failure(error);
        }
      }, 1000);
    } catch (error: any) {
      instance.setLock(false);
      instance.failure(error);
    }
  }
}
