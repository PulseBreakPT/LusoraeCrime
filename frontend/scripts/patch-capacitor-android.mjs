import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainActivity = path.join(
  root,
  "android",
  "app",
  "src",
  "main",
  "java",
  "pt",
  "lusorae",
  "crime",
  "MainActivity.java"
);

if (!fs.existsSync(mainActivity)) {
  throw new Error(`MainActivity não encontrado: ${mainActivity}`);
}

const source = `package pt.lusorae.crime;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.i("Google Activity Result", "SocialLogin login handle is null");
                return;
            }

            Plugin plugin = pluginHandle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
                return;
            }

            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
`;

fs.writeFileSync(mainActivity, source, "utf8");
console.log("MainActivity preparado para Google Credential Manager.");

const variables = path.join(root, "android", "variables.gradle");
if (fs.existsSync(variables)) {
  let gradle = fs.readFileSync(variables, "utf8");
  gradle = gradle.replace(/minSdkVersion\s*=\s*\d+/, "minSdkVersion = 24");
  gradle = gradle.replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36");
  gradle = gradle.replace(/targetSdkVersion\s*=\s*\d+/, "targetSdkVersion = 36");
  fs.writeFileSync(variables, gradle, "utf8");
  console.log("Android configurado para compile/target SDK 36.");
}


const appGradle = path.join(root, "android", "app", "build.gradle");
if (fs.existsSync(appGradle)) {
  let gradle = fs.readFileSync(appGradle, "utf8");
  const versionCode = String(process.env.ANDROID_VERSION_CODE || "1").replace(/\D/g, "") || "1";
  const versionName = String(process.env.ANDROID_VERSION_NAME || "1.0.0").replace(/[^0-9A-Za-z._-]/g, "");
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  fs.writeFileSync(appGradle, gradle, "utf8");
  console.log(`Versão Android configurada: ${versionName} (code ${versionCode}).`);
}
