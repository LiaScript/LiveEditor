function e(e,t,i,n){Object.defineProperty(e,t,{get:i,set:n,enumerable:!0,configurable:!0})}var t="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},i={},n={},o=t.parcelRequire4f35;null==o&&((o=function(e){if(e in i)return i[e].exports;if(e in n){var t=n[e];delete n[e];var o={id:e,exports:{}};return i[e]=o,t.call(o.exports,o,o.exports),o.exports}var r=new Error("Cannot find module '"+e+"'");throw r.code="MODULE_NOT_FOUND",r}).register=function(e,t){n[e]=t},t.parcelRequire4f35=o),o.register("iMVUS",(function(e,t){o("1XW5B").register(JSON.parse('{"70dpY":"index.1d26c8a0.js","jiDEu":"index.62813297.css","lkIOL":"tsMode.460679fa.js"}'))})),o.register("1XW5B",(function(t,i){var n,o;e(t.exports,"register",(function(){return n}),(function(e){return n=e})),e(t.exports,"resolve",(function(){return o}),(function(e){return o=e}));var r={};n=function(e){for(var t=Object.keys(e),i=0;i<t.length;i++)r[t[i]]=e[t[i]]},o=function(e){var t=r[e];if(null==t)throw new Error("Could not resolve bundle with id "+e);return t}})),o.register("1UCgw",(function(t,i){var n,r,s,a;e(t.exports,"Buffer",(function(){return n}),(function(e){return n=e})),e(t.exports,"SlowBuffer",(function(){return r}),(function(e){return r=e})),e(t.exports,"INSPECT_MAX_BYTES",(function(){return s}),(function(e){return s=e})),e(t.exports,"kMaxLength",(function(){return a}),(function(e){return a=e}));var l=o("bYAiX"),h=o("9sT5e");const c="function"==typeof Symbol&&"function"==typeof Symbol.for?Symbol.for("nodejs.util.inspect.custom"):null;n=g,r=function(e){+e!=e&&(e=0);return g.alloc(+e)},s=50;const d=2147483647;function u(e){if(e>d)throw new RangeError('The value "'+e+'" is invalid for option "size"');const t=new Uint8Array(e);return Object.setPrototypeOf(t,g.prototype),t}function g(e,t,i){if("number"==typeof e){if("string"==typeof t)throw new TypeError('The "string" argument must be of type string. Received type number');return p(e)}return f(e,t,i)}function f(e,t,i){if("string"==typeof e)return function(e,t){"string"==typeof t&&""!==t||(t="utf8");if(!g.isEncoding(t))throw new TypeError("Unknown encoding: "+t);const i=0|v(e,t);let n=u(i);const o=n.write(e,t);o!==i&&(n=n.slice(0,o));return n}(e,t);if(ArrayBuffer.isView(e))return function(e){if(ee(e,Uint8Array)){const t=new Uint8Array(e);return C(t.buffer,t.byteOffset,t.byteLength)}return _(e)}(e);if(null==e)throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type "+typeof e);if(ee(e,ArrayBuffer)||e&&ee(e.buffer,ArrayBuffer))return C(e,t,i);if("undefined"!=typeof SharedArrayBuffer&&(ee(e,SharedArrayBuffer)||e&&ee(e.buffer,SharedArrayBuffer)))return C(e,t,i);if("number"==typeof e)throw new TypeError('The "value" argument must not be of type number. Received type number');const n=e.valueOf&&e.valueOf();if(null!=n&&n!==e)return g.from(n,t,i);const o=function(e){if(g.isBuffer(e)){const t=0|b(e.length),i=u(t);return 0===i.length||e.copy(i,0,0,t),i}if(void 0!==e.length)return"number"!=typeof e.length||te(e.length)?u(0):_(e);if("Buffer"===e.type&&Array.isArray(e.data))return _(e.data)}(e);if(o)return o;if("undefined"!=typeof Symbol&&null!=Symbol.toPrimitive&&"function"==typeof e[Symbol.toPrimitive])return g.from(e[Symbol.toPrimitive]("string"),t,i);throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type "+typeof e)}function m(e){if("number"!=typeof e)throw new TypeError('"size" argument must be of type number');if(e<0)throw new RangeError('The value "'+e+'" is invalid for option "size"')}function p(e){return m(e),u(e<0?0:0|b(e))}function _(e){const t=e.length<0?0:0|b(e.length),i=u(t);for(let n=0;n<t;n+=1)i[n]=255&e[n];return i}function C(e,t,i){if(t<0||e.byteLength<t)throw new RangeError('"offset" is outside of buffer bounds');if(e.byteLength<t+(i||0))throw new RangeError('"length" is outside of buffer bounds');let n;return n=void 0===t&&void 0===i?new Uint8Array(e):void 0===i?new Uint8Array(e,t):new Uint8Array(e,t,i),Object.setPrototypeOf(n,g.prototype),n}function b(e){if(e>=d)throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+d.toString(16)+" bytes");return 0|e}function v(e,t){if(g.isBuffer(e))return e.length;if(ArrayBuffer.isView(e)||ee(e,ArrayBuffer))return e.byteLength;if("string"!=typeof e)throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type '+typeof e);const i=e.length,n=arguments.length>2&&!0===arguments[2];if(!n&&0===i)return 0;let o=!1;for(;;)switch(t){case"ascii":case"latin1":case"binary":return i;case"utf8":case"utf-8":return Q(e).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return 2*i;case"hex":return i>>>1;case"base64":return X(e).length;default:if(o)return n?-1:Q(e).length;t=(""+t).toLowerCase(),o=!0}}function w(e,t,i){let n=!1;if((void 0===t||t<0)&&(t=0),t>this.length)return"";if((void 0===i||i>this.length)&&(i=this.length),i<=0)return"";if((i>>>=0)<=(t>>>=0))return"";for(e||(e="utf8");;)switch(e){case"hex":return A(this,t,i);case"utf8":case"utf-8":return T(this,t,i);case"ascii":return R(this,t,i);case"latin1":case"binary":return O(this,t,i);case"base64":return I(this,t,i);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return P(this,t,i);default:if(n)throw new TypeError("Unknown encoding: "+e);e=(e+"").toLowerCase(),n=!0}}function S(e,t,i){const n=e[t];e[t]=e[i],e[i]=n}function y(e,t,i,n,o){if(0===e.length)return-1;if("string"==typeof i?(n=i,i=0):i>2147483647?i=2147483647:i<-2147483648&&(i=-2147483648),te(i=+i)&&(i=o?0:e.length-1),i<0&&(i=e.length+i),i>=e.length){if(o)return-1;i=e.length-1}else if(i<0){if(!o)return-1;i=0}if("string"==typeof t&&(t=g.from(t,n)),g.isBuffer(t))return 0===t.length?-1:L(e,t,i,n,o);if("number"==typeof t)return t&=255,"function"==typeof Uint8Array.prototype.indexOf?o?Uint8Array.prototype.indexOf.call(e,t,i):Uint8Array.prototype.lastIndexOf.call(e,t,i):L(e,[t],i,n,o);throw new TypeError("val must be string, number or Buffer")}function L(e,t,i,n,o){let r,s=1,a=e.length,l=t.length;if(void 0!==n&&("ucs2"===(n=String(n).toLowerCase())||"ucs-2"===n||"utf16le"===n||"utf-16le"===n)){if(e.length<2||t.length<2)return-1;s=2,a/=2,l/=2,i/=2}function h(e,t){return 1===s?e[t]:e.readUInt16BE(t*s)}if(o){let n=-1;for(r=i;r<a;r++)if(h(e,r)===h(t,-1===n?0:r-n)){if(-1===n&&(n=r),r-n+1===l)return n*s}else-1!==n&&(r-=r-n),n=-1}else for(i+l>a&&(i=a-l),r=i;r>=0;r--){let i=!0;for(let n=0;n<l;n++)if(h(e,r+n)!==h(t,n)){i=!1;break}if(i)return r}return-1}function x(e,t,i,n){i=Number(i)||0;const o=e.length-i;n?(n=Number(n))>o&&(n=o):n=o;const r=t.length;let s;for(n>r/2&&(n=r/2),s=0;s<n;++s){const n=parseInt(t.substr(2*s,2),16);if(te(n))return s;e[i+s]=n}return s}function E(e,t,i,n){return J(Q(t,e.length-i),e,i,n)}function k(e,t,i,n){return J(function(e){const t=[];for(let i=0;i<e.length;++i)t.push(255&e.charCodeAt(i));return t}(t),e,i,n)}function D(e,t,i,n){return J(X(t),e,i,n)}function N(e,t,i,n){return J(function(e,t){let i,n,o;const r=[];for(let s=0;s<e.length&&!((t-=2)<0);++s)i=e.charCodeAt(s),n=i>>8,o=i%256,r.push(o),r.push(n);return r}(t,e.length-i),e,i,n)}function I(e,t,i){return 0===t&&i===e.length?l.fromByteArray(e):l.fromByteArray(e.slice(t,i))}function T(e,t,i){i=Math.min(e.length,i);const n=[];let o=t;for(;o<i;){const t=e[o];let r=null,s=t>239?4:t>223?3:t>191?2:1;if(o+s<=i){let i,n,a,l;switch(s){case 1:t<128&&(r=t);break;case 2:i=e[o+1],128==(192&i)&&(l=(31&t)<<6|63&i,l>127&&(r=l));break;case 3:i=e[o+1],n=e[o+2],128==(192&i)&&128==(192&n)&&(l=(15&t)<<12|(63&i)<<6|63&n,l>2047&&(l<55296||l>57343)&&(r=l));break;case 4:i=e[o+1],n=e[o+2],a=e[o+3],128==(192&i)&&128==(192&n)&&128==(192&a)&&(l=(15&t)<<18|(63&i)<<12|(63&n)<<6|63&a,l>65535&&l<1114112&&(r=l))}}null===r?(r=65533,s=1):r>65535&&(r-=65536,n.push(r>>>10&1023|55296),r=56320|1023&r),n.push(r),o+=s}return function(e){const t=e.length;if(t<=M)return String.fromCharCode.apply(String,e);let i="",n=0;for(;n<t;)i+=String.fromCharCode.apply(String,e.slice(n,n+=M));return i}(n)}a=d,g.TYPED_ARRAY_SUPPORT=function(){try{const e=new Uint8Array(1),t={foo:function(){return 42}};return Object.setPrototypeOf(t,Uint8Array.prototype),Object.setPrototypeOf(e,t),42===e.foo()}catch(e){return!1}}(),g.TYPED_ARRAY_SUPPORT||"undefined"==typeof console||"function"!=typeof console.error||console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."),Object.defineProperty(g.prototype,"parent",{enumerable:!0,get:function(){if(g.isBuffer(this))return this.buffer}}),Object.defineProperty(g.prototype,"offset",{enumerable:!0,get:function(){if(g.isBuffer(this))return this.byteOffset}}),g.poolSize=8192,g.from=function(e,t,i){return f(e,t,i)},Object.setPrototypeOf(g.prototype,Uint8Array.prototype),Object.setPrototypeOf(g,Uint8Array),g.alloc=function(e,t,i){return function(e,t,i){return m(e),e<=0?u(e):void 0!==t?"string"==typeof i?u(e).fill(t,i):u(e).fill(t):u(e)}(e,t,i)},g.allocUnsafe=function(e){return p(e)},g.allocUnsafeSlow=function(e){return p(e)},g.isBuffer=function(e){return null!=e&&!0===e._isBuffer&&e!==g.prototype},g.compare=function(e,t){if(ee(e,Uint8Array)&&(e=g.from(e,e.offset,e.byteLength)),ee(t,Uint8Array)&&(t=g.from(t,t.offset,t.byteLength)),!g.isBuffer(e)||!g.isBuffer(t))throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');if(e===t)return 0;let i=e.length,n=t.length;for(let o=0,r=Math.min(i,n);o<r;++o)if(e[o]!==t[o]){i=e[o],n=t[o];break}return i<n?-1:n<i?1:0},g.isEncoding=function(e){switch(String(e).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"latin1":case"binary":case"base64":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},g.concat=function(e,t){if(!Array.isArray(e))throw new TypeError('"list" argument must be an Array of Buffers');if(0===e.length)return g.alloc(0);let i;if(void 0===t)for(t=0,i=0;i<e.length;++i)t+=e[i].length;const n=g.allocUnsafe(t);let o=0;for(i=0;i<e.length;++i){let t=e[i];if(ee(t,Uint8Array))o+t.length>n.length?(g.isBuffer(t)||(t=g.from(t)),t.copy(n,o)):Uint8Array.prototype.set.call(n,t,o);else{if(!g.isBuffer(t))throw new TypeError('"list" argument must be an Array of Buffers');t.copy(n,o)}o+=t.length}return n},g.byteLength=v,g.prototype._isBuffer=!0,g.prototype.swap16=function(){const e=this.length;if(e%2!=0)throw new RangeError("Buffer size must be a multiple of 16-bits");for(let t=0;t<e;t+=2)S(this,t,t+1);return this},g.prototype.swap32=function(){const e=this.length;if(e%4!=0)throw new RangeError("Buffer size must be a multiple of 32-bits");for(let t=0;t<e;t+=4)S(this,t,t+3),S(this,t+1,t+2);return this},g.prototype.swap64=function(){const e=this.length;if(e%8!=0)throw new RangeError("Buffer size must be a multiple of 64-bits");for(let t=0;t<e;t+=8)S(this,t,t+7),S(this,t+1,t+6),S(this,t+2,t+5),S(this,t+3,t+4);return this},g.prototype.toString=function(){const e=this.length;return 0===e?"":0===arguments.length?T(this,0,e):w.apply(this,arguments)},g.prototype.toLocaleString=g.prototype.toString,g.prototype.equals=function(e){if(!g.isBuffer(e))throw new TypeError("Argument must be a Buffer");return this===e||0===g.compare(this,e)},g.prototype.inspect=function(){let e="";const t=s;return e=this.toString("hex",0,t).replace(/(.{2})/g,"$1 ").trim(),this.length>t&&(e+=" ... "),"<Buffer "+e+">"},c&&(g.prototype[c]=g.prototype.inspect),g.prototype.compare=function(e,t,i,n,o){if(ee(e,Uint8Array)&&(e=g.from(e,e.offset,e.byteLength)),!g.isBuffer(e))throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type '+typeof e);if(void 0===t&&(t=0),void 0===i&&(i=e?e.length:0),void 0===n&&(n=0),void 0===o&&(o=this.length),t<0||i>e.length||n<0||o>this.length)throw new RangeError("out of range index");if(n>=o&&t>=i)return 0;if(n>=o)return-1;if(t>=i)return 1;if(this===e)return 0;let r=(o>>>=0)-(n>>>=0),s=(i>>>=0)-(t>>>=0);const a=Math.min(r,s),l=this.slice(n,o),h=e.slice(t,i);for(let e=0;e<a;++e)if(l[e]!==h[e]){r=l[e],s=h[e];break}return r<s?-1:s<r?1:0},g.prototype.includes=function(e,t,i){return-1!==this.indexOf(e,t,i)},g.prototype.indexOf=function(e,t,i){return y(this,e,t,i,!0)},g.prototype.lastIndexOf=function(e,t,i){return y(this,e,t,i,!1)},g.prototype.write=function(e,t,i,n){if(void 0===t)n="utf8",i=this.length,t=0;else if(void 0===i&&"string"==typeof t)n=t,i=this.length,t=0;else{if(!isFinite(t))throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");t>>>=0,isFinite(i)?(i>>>=0,void 0===n&&(n="utf8")):(n=i,i=void 0)}const o=this.length-t;if((void 0===i||i>o)&&(i=o),e.length>0&&(i<0||t<0)||t>this.length)throw new RangeError("Attempt to write outside buffer bounds");n||(n="utf8");let r=!1;for(;;)switch(n){case"hex":return x(this,e,t,i);case"utf8":case"utf-8":return E(this,e,t,i);case"ascii":case"latin1":case"binary":return k(this,e,t,i);case"base64":return D(this,e,t,i);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return N(this,e,t,i);default:if(r)throw new TypeError("Unknown encoding: "+n);n=(""+n).toLowerCase(),r=!0}},g.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};const M=4096;function R(e,t,i){let n="";i=Math.min(e.length,i);for(let o=t;o<i;++o)n+=String.fromCharCode(127&e[o]);return n}function O(e,t,i){let n="";i=Math.min(e.length,i);for(let o=t;o<i;++o)n+=String.fromCharCode(e[o]);return n}function A(e,t,i){const n=e.length;(!t||t<0)&&(t=0),(!i||i<0||i>n)&&(i=n);let o="";for(let n=t;n<i;++n)o+=ie[e[n]];return o}function P(e,t,i){const n=e.slice(t,i);let o="";for(let e=0;e<n.length-1;e+=2)o+=String.fromCharCode(n[e]+256*n[e+1]);return o}function F(e,t,i){if(e%1!=0||e<0)throw new RangeError("offset is not uint");if(e+t>i)throw new RangeError("Trying to access beyond buffer length")}function B(e,t,i,n,o,r){if(!g.isBuffer(e))throw new TypeError('"buffer" argument must be a Buffer instance');if(t>o||t<r)throw new RangeError('"value" argument is out of bounds');if(i+n>e.length)throw new RangeError("Index out of range")}function z(e,t,i,n,o){$(t,n,o,e,i,7);let r=Number(t&BigInt(4294967295));e[i++]=r,r>>=8,e[i++]=r,r>>=8,e[i++]=r,r>>=8,e[i++]=r;let s=Number(t>>BigInt(32)&BigInt(4294967295));return e[i++]=s,s>>=8,e[i++]=s,s>>=8,e[i++]=s,s>>=8,e[i++]=s,i}function W(e,t,i,n,o){$(t,n,o,e,i,7);let r=Number(t&BigInt(4294967295));e[i+7]=r,r>>=8,e[i+6]=r,r>>=8,e[i+5]=r,r>>=8,e[i+4]=r;let s=Number(t>>BigInt(32)&BigInt(4294967295));return e[i+3]=s,s>>=8,e[i+2]=s,s>>=8,e[i+1]=s,s>>=8,e[i]=s,i+8}function V(e,t,i,n,o,r){if(i+n>e.length)throw new RangeError("Index out of range");if(i<0)throw new RangeError("Index out of range")}function H(e,t,i,n,o){return t=+t,i>>>=0,o||V(e,0,i,4),h.write(e,t,i,n,23,4),i+4}function U(e,t,i,n,o){return t=+t,i>>>=0,o||V(e,0,i,8),h.write(e,t,i,n,52,8),i+8}g.prototype.slice=function(e,t){const i=this.length;(e=~~e)<0?(e+=i)<0&&(e=0):e>i&&(e=i),(t=void 0===t?i:~~t)<0?(t+=i)<0&&(t=0):t>i&&(t=i),t<e&&(t=e);const n=this.subarray(e,t);return Object.setPrototypeOf(n,g.prototype),n},g.prototype.readUintLE=g.prototype.readUIntLE=function(e,t,i){e>>>=0,t>>>=0,i||F(e,t,this.length);let n=this[e],o=1,r=0;for(;++r<t&&(o*=256);)n+=this[e+r]*o;return n},g.prototype.readUintBE=g.prototype.readUIntBE=function(e,t,i){e>>>=0,t>>>=0,i||F(e,t,this.length);let n=this[e+--t],o=1;for(;t>0&&(o*=256);)n+=this[e+--t]*o;return n},g.prototype.readUint8=g.prototype.readUInt8=function(e,t){return e>>>=0,t||F(e,1,this.length),this[e]},g.prototype.readUint16LE=g.prototype.readUInt16LE=function(e,t){return e>>>=0,t||F(e,2,this.length),this[e]|this[e+1]<<8},g.prototype.readUint16BE=g.prototype.readUInt16BE=function(e,t){return e>>>=0,t||F(e,2,this.length),this[e]<<8|this[e+1]},g.prototype.readUint32LE=g.prototype.readUInt32LE=function(e,t){return e>>>=0,t||F(e,4,this.length),(this[e]|this[e+1]<<8|this[e+2]<<16)+16777216*this[e+3]},g.prototype.readUint32BE=g.prototype.readUInt32BE=function(e,t){return e>>>=0,t||F(e,4,this.length),16777216*this[e]+(this[e+1]<<16|this[e+2]<<8|this[e+3])},g.prototype.readBigUInt64LE=ne((function(e){G(e>>>=0,"offset");const t=this[e],i=this[e+7];void 0!==t&&void 0!==i||Y(e,this.length-8);const n=t+256*this[++e]+65536*this[++e]+this[++e]*2**24,o=this[++e]+256*this[++e]+65536*this[++e]+i*2**24;return BigInt(n)+(BigInt(o)<<BigInt(32))})),g.prototype.readBigUInt64BE=ne((function(e){G(e>>>=0,"offset");const t=this[e],i=this[e+7];void 0!==t&&void 0!==i||Y(e,this.length-8);const n=t*2**24+65536*this[++e]+256*this[++e]+this[++e],o=this[++e]*2**24+65536*this[++e]+256*this[++e]+i;return(BigInt(n)<<BigInt(32))+BigInt(o)})),g.prototype.readIntLE=function(e,t,i){e>>>=0,t>>>=0,i||F(e,t,this.length);let n=this[e],o=1,r=0;for(;++r<t&&(o*=256);)n+=this[e+r]*o;return o*=128,n>=o&&(n-=Math.pow(2,8*t)),n},g.prototype.readIntBE=function(e,t,i){e>>>=0,t>>>=0,i||F(e,t,this.length);let n=t,o=1,r=this[e+--n];for(;n>0&&(o*=256);)r+=this[e+--n]*o;return o*=128,r>=o&&(r-=Math.pow(2,8*t)),r},g.prototype.readInt8=function(e,t){return e>>>=0,t||F(e,1,this.length),128&this[e]?-1*(255-this[e]+1):this[e]},g.prototype.readInt16LE=function(e,t){e>>>=0,t||F(e,2,this.length);const i=this[e]|this[e+1]<<8;return 32768&i?4294901760|i:i},g.prototype.readInt16BE=function(e,t){e>>>=0,t||F(e,2,this.length);const i=this[e+1]|this[e]<<8;return 32768&i?4294901760|i:i},g.prototype.readInt32LE=function(e,t){return e>>>=0,t||F(e,4,this.length),this[e]|this[e+1]<<8|this[e+2]<<16|this[e+3]<<24},g.prototype.readInt32BE=function(e,t){return e>>>=0,t||F(e,4,this.length),this[e]<<24|this[e+1]<<16|this[e+2]<<8|this[e+3]},g.prototype.readBigInt64LE=ne((function(e){G(e>>>=0,"offset");const t=this[e],i=this[e+7];void 0!==t&&void 0!==i||Y(e,this.length-8);const n=this[e+4]+256*this[e+5]+65536*this[e+6]+(i<<24);return(BigInt(n)<<BigInt(32))+BigInt(t+256*this[++e]+65536*this[++e]+this[++e]*2**24)})),g.prototype.readBigInt64BE=ne((function(e){G(e>>>=0,"offset");const t=this[e],i=this[e+7];void 0!==t&&void 0!==i||Y(e,this.length-8);const n=(t<<24)+65536*this[++e]+256*this[++e]+this[++e];return(BigInt(n)<<BigInt(32))+BigInt(this[++e]*2**24+65536*this[++e]+256*this[++e]+i)})),g.prototype.readFloatLE=function(e,t){return e>>>=0,t||F(e,4,this.length),h.read(this,e,!0,23,4)},g.prototype.readFloatBE=function(e,t){return e>>>=0,t||F(e,4,this.length),h.read(this,e,!1,23,4)},g.prototype.readDoubleLE=function(e,t){return e>>>=0,t||F(e,8,this.length),h.read(this,e,!0,52,8)},g.prototype.readDoubleBE=function(e,t){return e>>>=0,t||F(e,8,this.length),h.read(this,e,!1,52,8)},g.prototype.writeUintLE=g.prototype.writeUIntLE=function(e,t,i,n){if(e=+e,t>>>=0,i>>>=0,!n){B(this,e,t,i,Math.pow(2,8*i)-1,0)}let o=1,r=0;for(this[t]=255&e;++r<i&&(o*=256);)this[t+r]=e/o&255;return t+i},g.prototype.writeUintBE=g.prototype.writeUIntBE=function(e,t,i,n){if(e=+e,t>>>=0,i>>>=0,!n){B(this,e,t,i,Math.pow(2,8*i)-1,0)}let o=i-1,r=1;for(this[t+o]=255&e;--o>=0&&(r*=256);)this[t+o]=e/r&255;return t+i},g.prototype.writeUint8=g.prototype.writeUInt8=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,1,255,0),this[t]=255&e,t+1},g.prototype.writeUint16LE=g.prototype.writeUInt16LE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,2,65535,0),this[t]=255&e,this[t+1]=e>>>8,t+2},g.prototype.writeUint16BE=g.prototype.writeUInt16BE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,2,65535,0),this[t]=e>>>8,this[t+1]=255&e,t+2},g.prototype.writeUint32LE=g.prototype.writeUInt32LE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,4,4294967295,0),this[t+3]=e>>>24,this[t+2]=e>>>16,this[t+1]=e>>>8,this[t]=255&e,t+4},g.prototype.writeUint32BE=g.prototype.writeUInt32BE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,4,4294967295,0),this[t]=e>>>24,this[t+1]=e>>>16,this[t+2]=e>>>8,this[t+3]=255&e,t+4},g.prototype.writeBigUInt64LE=ne((function(e,t=0){return z(this,e,t,BigInt(0),BigInt("0xffffffffffffffff"))})),g.prototype.writeBigUInt64BE=ne((function(e,t=0){return W(this,e,t,BigInt(0),BigInt("0xffffffffffffffff"))})),g.prototype.writeIntLE=function(e,t,i,n){if(e=+e,t>>>=0,!n){const n=Math.pow(2,8*i-1);B(this,e,t,i,n-1,-n)}let o=0,r=1,s=0;for(this[t]=255&e;++o<i&&(r*=256);)e<0&&0===s&&0!==this[t+o-1]&&(s=1),this[t+o]=(e/r>>0)-s&255;return t+i},g.prototype.writeIntBE=function(e,t,i,n){if(e=+e,t>>>=0,!n){const n=Math.pow(2,8*i-1);B(this,e,t,i,n-1,-n)}let o=i-1,r=1,s=0;for(this[t+o]=255&e;--o>=0&&(r*=256);)e<0&&0===s&&0!==this[t+o+1]&&(s=1),this[t+o]=(e/r>>0)-s&255;return t+i},g.prototype.writeInt8=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,1,127,-128),e<0&&(e=255+e+1),this[t]=255&e,t+1},g.prototype.writeInt16LE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,2,32767,-32768),this[t]=255&e,this[t+1]=e>>>8,t+2},g.prototype.writeInt16BE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,2,32767,-32768),this[t]=e>>>8,this[t+1]=255&e,t+2},g.prototype.writeInt32LE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,4,2147483647,-2147483648),this[t]=255&e,this[t+1]=e>>>8,this[t+2]=e>>>16,this[t+3]=e>>>24,t+4},g.prototype.writeInt32BE=function(e,t,i){return e=+e,t>>>=0,i||B(this,e,t,4,2147483647,-2147483648),e<0&&(e=4294967295+e+1),this[t]=e>>>24,this[t+1]=e>>>16,this[t+2]=e>>>8,this[t+3]=255&e,t+4},g.prototype.writeBigInt64LE=ne((function(e,t=0){return z(this,e,t,-BigInt("0x8000000000000000"),BigInt("0x7fffffffffffffff"))})),g.prototype.writeBigInt64BE=ne((function(e,t=0){return W(this,e,t,-BigInt("0x8000000000000000"),BigInt("0x7fffffffffffffff"))})),g.prototype.writeFloatLE=function(e,t,i){return H(this,e,t,!0,i)},g.prototype.writeFloatBE=function(e,t,i){return H(this,e,t,!1,i)},g.prototype.writeDoubleLE=function(e,t,i){return U(this,e,t,!0,i)},g.prototype.writeDoubleBE=function(e,t,i){return U(this,e,t,!1,i)},g.prototype.copy=function(e,t,i,n){if(!g.isBuffer(e))throw new TypeError("argument should be a Buffer");if(i||(i=0),n||0===n||(n=this.length),t>=e.length&&(t=e.length),t||(t=0),n>0&&n<i&&(n=i),n===i)return 0;if(0===e.length||0===this.length)return 0;if(t<0)throw new RangeError("targetStart out of bounds");if(i<0||i>=this.length)throw new RangeError("Index out of range");if(n<0)throw new RangeError("sourceEnd out of bounds");n>this.length&&(n=this.length),e.length-t<n-i&&(n=e.length-t+i);const o=n-i;return this===e&&"function"==typeof Uint8Array.prototype.copyWithin?this.copyWithin(t,i,n):Uint8Array.prototype.set.call(e,this.subarray(i,n),t),o},g.prototype.fill=function(e,t,i,n){if("string"==typeof e){if("string"==typeof t?(n=t,t=0,i=this.length):"string"==typeof i&&(n=i,i=this.length),void 0!==n&&"string"!=typeof n)throw new TypeError("encoding must be a string");if("string"==typeof n&&!g.isEncoding(n))throw new TypeError("Unknown encoding: "+n);if(1===e.length){const t=e.charCodeAt(0);("utf8"===n&&t<128||"latin1"===n)&&(e=t)}}else"number"==typeof e?e&=255:"boolean"==typeof e&&(e=Number(e));if(t<0||this.length<t||this.length<i)throw new RangeError("Out of range index");if(i<=t)return this;let o;if(t>>>=0,i=void 0===i?this.length:i>>>0,e||(e=0),"number"==typeof e)for(o=t;o<i;++o)this[o]=e;else{const r=g.isBuffer(e)?e:g.from(e,n),s=r.length;if(0===s)throw new TypeError('The value "'+e+'" is invalid for argument "value"');for(o=0;o<i-t;++o)this[o+t]=r[o%s]}return this};const K={};function j(e,t,i){K[e]=class extends i{get code(){return e}set code(e){Object.defineProperty(this,"code",{configurable:!0,enumerable:!0,value:e,writable:!0})}toString(){return`${this.name} [${e}]: ${this.message}`}constructor(){super(),Object.defineProperty(this,"message",{value:t.apply(this,arguments),writable:!0,configurable:!0}),this.name=`${this.name} [${e}]`,this.stack,delete this.name}}}function q(e){let t="",i=e.length;const n="-"===e[0]?1:0;for(;i>=n+4;i-=3)t=`_${e.slice(i-3,i)}${t}`;return`${e.slice(0,i)}${t}`}function $(e,t,i,n,o,r){if(e>i||e<t){const n="bigint"==typeof t?"n":"";let o;throw o=r>3?0===t||t===BigInt(0)?`>= 0${n} and < 2${n} ** ${8*(r+1)}${n}`:`>= -(2${n} ** ${8*(r+1)-1}${n}) and < 2 ** ${8*(r+1)-1}${n}`:`>= ${t}${n} and <= ${i}${n}`,new K.ERR_OUT_OF_RANGE("value",o,e)}!function(e,t,i){G(t,"offset"),void 0!==e[t]&&void 0!==e[t+i]||Y(t,e.length-(i+1))}(n,o,r)}function G(e,t){if("number"!=typeof e)throw new K.ERR_INVALID_ARG_TYPE(t,"number",e)}function Y(e,t,i){if(Math.floor(e)!==e)throw G(e,i),new K.ERR_OUT_OF_RANGE(i||"offset","an integer",e);if(t<0)throw new K.ERR_BUFFER_OUT_OF_BOUNDS;throw new K.ERR_OUT_OF_RANGE(i||"offset",`>= ${i?1:0} and <= ${t}`,e)}j("ERR_BUFFER_OUT_OF_BOUNDS",(function(e){return e?`${e} is outside of buffer bounds`:"Attempt to access memory outside buffer bounds"}),RangeError),j("ERR_INVALID_ARG_TYPE",(function(e,t){return`The "${e}" argument must be of type number. Received type ${typeof t}`}),TypeError),j("ERR_OUT_OF_RANGE",(function(e,t,i){let n=`The value of "${e}" is out of range.`,o=i;return Number.isInteger(i)&&Math.abs(i)>2**32?o=q(String(i)):"bigint"==typeof i&&(o=String(i),(i>BigInt(2)**BigInt(32)||i<-(BigInt(2)**BigInt(32)))&&(o=q(o)),o+="n"),n+=` It must be ${t}. Received ${o}`,n}),RangeError);const Z=/[^+/0-9A-Za-z-_]/g;function Q(e,t){let i;t=t||1/0;const n=e.length;let o=null;const r=[];for(let s=0;s<n;++s){if(i=e.charCodeAt(s),i>55295&&i<57344){if(!o){if(i>56319){(t-=3)>-1&&r.push(239,191,189);continue}if(s+1===n){(t-=3)>-1&&r.push(239,191,189);continue}o=i;continue}if(i<56320){(t-=3)>-1&&r.push(239,191,189),o=i;continue}i=65536+(o-55296<<10|i-56320)}else o&&(t-=3)>-1&&r.push(239,191,189);if(o=null,i<128){if((t-=1)<0)break;r.push(i)}else if(i<2048){if((t-=2)<0)break;r.push(i>>6|192,63&i|128)}else if(i<65536){if((t-=3)<0)break;r.push(i>>12|224,i>>6&63|128,63&i|128)}else{if(!(i<1114112))throw new Error("Invalid code point");if((t-=4)<0)break;r.push(i>>18|240,i>>12&63|128,i>>6&63|128,63&i|128)}}return r}function X(e){return l.toByteArray(function(e){if((e=(e=e.split("=")[0]).trim().replace(Z,"")).length<2)return"";for(;e.length%4!=0;)e+="=";return e}(e))}function J(e,t,i,n){let o;for(o=0;o<n&&!(o+i>=t.length||o>=e.length);++o)t[o+i]=e[o];return o}function ee(e,t){return e instanceof t||null!=e&&null!=e.constructor&&null!=e.constructor.name&&e.constructor.name===t.name}function te(e){return e!=e}const ie=function(){const e="0123456789abcdef",t=new Array(256);for(let i=0;i<16;++i){const n=16*i;for(let o=0;o<16;++o)t[n+o]=e[i]+e[o]}return t}();function ne(e){return"undefined"==typeof BigInt?oe:e}function oe(){throw new Error("BigInt not supported")}})),o.register("bYAiX",(function(t,i){var n,o;e(t.exports,"toByteArray",(function(){return n}),(function(e){return n=e})),e(t.exports,"fromByteArray",(function(){return o}),(function(e){return o=e})),n=function(e){var t,i,n=d(e),o=n[0],r=n[1],l=new a(function(e,t,i){return 3*(t+i)/4-i}(0,o,r)),h=0,c=r>0?o-4:o;for(i=0;i<c;i+=4)t=s[e.charCodeAt(i)]<<18|s[e.charCodeAt(i+1)]<<12|s[e.charCodeAt(i+2)]<<6|s[e.charCodeAt(i+3)],l[h++]=t>>16&255,l[h++]=t>>8&255,l[h++]=255&t;2===r&&(t=s[e.charCodeAt(i)]<<2|s[e.charCodeAt(i+1)]>>4,l[h++]=255&t);1===r&&(t=s[e.charCodeAt(i)]<<10|s[e.charCodeAt(i+1)]<<4|s[e.charCodeAt(i+2)]>>2,l[h++]=t>>8&255,l[h++]=255&t);return l},o=function(e){for(var t,i=e.length,n=i%3,o=[],s=16383,a=0,l=i-n;a<l;a+=s)o.push(u(e,a,a+s>l?l:a+s));1===n?(t=e[i-1],o.push(r[t>>2]+r[t<<4&63]+"==")):2===n&&(t=(e[i-2]<<8)+e[i-1],o.push(r[t>>10]+r[t>>4&63]+r[t<<2&63]+"="));return o.join("")};for(var r=[],s=[],a="undefined"!=typeof Uint8Array?Uint8Array:Array,l="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",h=0,c=l.length;h<c;++h)r[h]=l[h],s[l.charCodeAt(h)]=h;function d(e){var t=e.length;if(t%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var i=e.indexOf("=");return-1===i&&(i=t),[i,i===t?0:4-i%4]}function u(e,t,i){for(var n,o,s=[],a=t;a<i;a+=3)n=(e[a]<<16&16711680)+(e[a+1]<<8&65280)+(255&e[a+2]),s.push(r[(o=n)>>18&63]+r[o>>12&63]+r[o>>6&63]+r[63&o]);return s.join("")}s["-".charCodeAt(0)]=62,s["_".charCodeAt(0)]=63})),o.register("9sT5e",(function(t,i){