package com.rui66648.lifestyle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 本地模型插件（llama.cpp 桥接）
 * 骨架实现，后续集成 llama.cpp JNI 库
 */
@CapacitorPlugin(name = "LocalModel")
public class LocalModelPlugin extends Plugin {

    private boolean isModelLoaded = false;
    private String modelPath = "";

    @Override
    public void load() {
        // 插件初始化时调用
        super.load();
    }

    /**
     * 加载本地 GGUF 模型
     */
    @PluginMethod
    public void loadModel(PluginCall call) {
        String path = call.getString("modelPath", "");
        if (path == null || path.isEmpty()) {
            call.reject("模型路径不能为空");
            return;
        }
        this.modelPath = path;
        // TODO: 集成 llama.cpp 后实现真实加载
        // 当前返回模拟状态
        this.isModelLoaded = false;

        JSObject ret = new JSObject();
        ret.put("loaded", false);
        ret.put("message", "本地模型功能尚未完全集成。请在设置中切换到云端模型使用。");
        call.resolve(ret);
    }

    /**
     * 检查模型是否已加载
     */
    @PluginMethod
    public void isLoaded(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", isModelLoaded);
        ret.put("modelPath", modelPath);
        call.resolve(ret);
    }

    /**
     * 聊天推理
     */
    @PluginMethod
    public void chat(PluginCall call) {
        if (!isModelLoaded) {
            call.reject("模型未加载，请先调用 loadModel");
            return;
        }
        // TODO: 集成 llama.cpp 后实现真实推理
        call.reject("本地模型推理功能尚未实现。请在设置中切换到云端模型。");
    }

    /**
     * 获取插件状态
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", false);
        ret.put("loaded", isModelLoaded);
        ret.put("modelPath", modelPath);
        ret.put("message", "本地模型插件骨架已就绪，需进一步集成 llama.cpp JNI 库");
        call.resolve(ret);
    }
}
