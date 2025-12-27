const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class PathPlannerPreviewProvider {

    /**
     * @param {vscode.ExtensionContext} context
     */
    constructor(context) {
        this.context = context;
    }

    /**
     * @param {vscode.TextDocument} document
     * @param {vscode.WebviewPanel} webviewPanel
     * @param {vscode.CancellationToken} token
     */
    async resolveCustomTextEditor(document, webviewPanel, token) {
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        const updateWebview = () => {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        };

        // Hook up event listeners so that we can sync the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                // Handle messages if needed (e.g. if we make it editable later)
            }
        });

        updateWebview();
    }

    /**
     * @param {vscode.Webview} webview
     */
    getHtmlForWebview(webview) {
        const htmlPath = path.join(this.context.extensionPath, 'src', 'webviews', 'pathPlannerPreview.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Get path to the field image
        const fieldImagePath = vscode.Uri.file(
            path.join(this.context.extensionPath, 'src', 'webviews', 'media', 'field.png')
        );
        const fieldImageUri = webview.asWebviewUri(fieldImagePath);

        // Replace placeholder in HTML with actual URI
        htmlContent = htmlContent.replace('${fieldImageUri}', fieldImageUri.toString());
        
        return htmlContent;
    }
}

module.exports = PathPlannerPreviewProvider;
