!function(){var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},t={},n={},r=e.parcelRequire4f35;null==r&&((r=function(e){if(e in t)return t[e].exports;if(e in n){var r=n[e];delete n[e];var o={id:e,exports:{}};return t[e]=o,r.call(o.exports,o,o.exports),o.exports}var i=new Error("Cannot find module '"+e+"'");throw i.code="MODULE_NOT_FOUND",i}).register=function(e,t){n[e]=t},e.parcelRequire4f35=r);var o,i,u,a,s=r("i376O"),c={};o=c,i="JSONWorker",u=function(){return d},a=function(e){return d=e},Object.defineProperty(o,i,{get:u,set:a,enumerable:!0,configurable:!0});var l,f=r("l9qeN"),g=r("fRQPU"),h=function(e,t,n,r){return new(n||(n=Promise))((function(o,i){var u=function(e){try{s(r.next(e))}catch(e){i(e)}},a=function(e){try{s(r.throw(e))}catch(e){i(e)}},s=function(e){var t;e.done?o(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t)}))).then(u,a)};s((r=r.apply(e,t||[])).next())}))},v=function(e,t){var n,r,o,i,u=function(e){return function(t){return a([e,t])}},a=function(i){if(n)throw new TypeError("Generator is already executing.");for(;s;)try{if(n=1,r&&(o=2&i[0]?r.return:i[0]?r.throw||((o=r.return)&&o.call(r),0):r.next)&&!(o=o.call(r,i[1])).done)return o;switch(r=0,o&&(i=[2&i[0],o.value]),i[0]){case 0:case 1:o=i;break;case 4:return s.label++,{value:i[1],done:!1};case 5:s.label++,r=i[1],i=[0];continue;case 7:i=s.ops.pop(),s.trys.pop();continue;default:if(!(o=s.trys,(o=o.length>0&&o[o.length-1])||6!==i[0]&&2!==i[0])){s=0;continue}if(3===i[0]&&(!o||i[1]>o[0]&&i[1]<o[3])){s.label=i[1];break}if(6===i[0]&&s.label<o[1]){s.label=o[1],o=i;break}if(o&&s.label<o[2]){s.label=o[2],s.ops.push(i);break}o[2]&&s.ops.pop(),s.trys.pop();continue}i=t.call(e,s)}catch(e){i=[6,e],r=0}finally{n=o=0}if(5&i[0])throw i[1];return{value:i[0]?i[1]:void 0,done:!0}},s={label:0,sent:function(){if(1&o[0])throw o[1];return o[1]},trys:[],ops:[]};return i={next:u(0),throw:u(1),return:u(2)},"function"==typeof Symbol&&(i[Symbol.iterator]=function(){return this}),i};"undefined"!=typeof fetch&&(l=function(e){return fetch(e).then((function(e){return e.text()}))});var p,d=(p=function(e,t){this._ctx=e,this._languageSettings=t.languageSettings,this._languageId=t.languageId,this._languageService=f.getLanguageService({workspaceContext:{resolveRelativePath:function(e,t){return function(e,t){if(function(e){return e.charCodeAt(0)===S}(t)){var n=g.URI.parse(e),r=t.split("/");return n.with({path:_(r)}).toString()}return function(e){for(var t=[],n=1;n<arguments.length;n++)t[n-1]=arguments[n];for(var r=g.URI.parse(e),o=r.path.split("/"),i=0,u=t;i<u.length;i++){var a=u[i];o.push.apply(o,a.split("/"))}return r.with({path:_(o)}).toString()}(e,t)}(t.substr(0,t.lastIndexOf("/")+1),e)}},schemaRequestService:t.enableSchemaRequest&&l}),this._languageService.configure(this._languageSettings)},p.prototype.doValidation=function(e){return h(this,void 0,void 0,(function(){var t,n;return v(this,(function(r){return(t=this._getTextDocument(e))?(n=this._languageService.parseJSONDocument(t),[2,this._languageService.doValidation(t,n,this._languageSettings)]):[2,Promise.resolve([])]}))}))},p.prototype.doComplete=function(e,t){return h(this,void 0,void 0,(function(){var n,r;return v(this,(function(o){return n=this._getTextDocument(e),r=this._languageService.parseJSONDocument(n),[2,this._languageService.doComplete(n,t,r)]}))}))},p.prototype.doResolve=function(e){return h(this,void 0,void 0,(function(){return v(this,(function(t){return[2,this._languageService.doResolve(e)]}))}))},p.prototype.doHover=function(e,t){return h(this,void 0,void 0,(function(){var n,r;return v(this,(function(o){return n=this._getTextDocument(e),r=this._languageService.parseJSONDocument(n),[2,this._languageService.doHover(n,t,r)]}))}))},p.prototype.format=function(e,t,n){return h(this,void 0,void 0,(function(){var r,o;return v(this,(function(i){return r=this._getTextDocument(e),o=this._languageService.format(r,t,n),[2,Promise.resolve(o)]}))}))},p.prototype.resetSchema=function(e){return h(this,void 0,void 0,(function(){return v(this,(function(t){return[2,Promise.resolve(this._languageService.resetSchema(e))]}))}))},p.prototype.findDocumentSymbols=function(e){return h(this,void 0,void 0,(function(){var t,n,r;return v(this,(function(o){return t=this._getTextDocument(e),n=this._languageService.parseJSONDocument(t),r=this._languageService.findDocumentSymbols(t,n),[2,Promise.resolve(r)]}))}))},p.prototype.findDocumentColors=function(e){return h(this,void 0,void 0,(function(){var t,n,r;return v(this,(function(o){return t=this._getTextDocument(e),n=this._languageService.parseJSONDocument(t),r=this._languageService.findDocumentColors(t,n),[2,Promise.resolve(r)]}))}))},p.prototype.getColorPresentations=function(e,t,n){return h(this,void 0,void 0,(function(){var r,o,i;return v(this,(function(u){return r=this._getTextDocument(e),o=this._languageService.parseJSONDocument(r),i=this._languageService.getColorPresentations(r,o,t,n),[2,Promise.resolve(i)]}))}))},p.prototype.getFoldingRanges=function(e,t){return h(this,void 0,void 0,(function(){var n,r;return v(this,(function(o){return n=this._getTextDocument(e),r=this._languageService.getFoldingRanges(n,t),[2,Promise.resolve(r)]}))}))},p.prototype.getSelectionRanges=function(e,t){return h(this,void 0,void 0,(function(){var n,r,o;return v(this,(function(i){return n=this._getTextDocument(e),r=this._languageService.parseJSONDocument(n),o=this._languageService.getSelectionRanges(n,t,r),[2,Promise.resolve(o)]}))}))},p.prototype._getTextDocument=function(e){for(var t=0,n=this._ctx.getMirrorModels();t<n.length;t++){var r=n[t];if(r.uri.toString()===e)return f.TextDocument.create(e,this._languageId,r.version,r.getValue())}return null},p),S="/".charCodeAt(0),m=".".charCodeAt(0);function _(e){for(var t=[],n=0,r=e;n<r.length;n++){var o=r[n];0===o.length||1===o.length&&o.charCodeAt(0)===m||(2===o.length&&o.charCodeAt(0)===m&&o.charCodeAt(1)===m?t.pop():t.push(o))}e.length>1&&0===e[e.length-1].length&&t.push("");var i=t.join("/");return 0===e[0].length&&(i="/"+i),i}self.onmessage=function(){s.initialize((function(e,t){return new(0,c.JSONWorker)(e,t)}))}}();