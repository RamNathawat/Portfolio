var VanillaTilt = (function() {
    "use strict";

    class VanillaTilt {
        constructor(element, settings = {}) {
            if (!(element instanceof Node)) {
                throw "Can't initialize VanillaTilt because " + element + " is not a Node.";
            }

            this.width = null;
            this.height = null;
            this.clientWidth = null;
            this.clientHeight = null;
            this.left = null;
            this.top = null;
            this.gammazero = null;
            this.betazero = null;
            this.lastgammazero = null;
            this.lastbetazero = null;
            this.transitionTimeout = null;
            this.updateCall = null;
            this.event = null;
            this.updateBind = this.update.bind(this);
            this.resetBind = this.reset.bind(this);
            this.element = element;
            this.settings = this.extendSettings(settings);
            this.reverse = this.settings.reverse ? -1 : 1;
            this.resetToStart = VanillaTilt.isSettingTrue(this.settings["reset-to-start"]);
            this.glare = VanillaTilt.isSettingTrue(this.settings.glare);
            this.glarePrerender = VanillaTilt.isSettingTrue(this.settings["glare-prerender"]);
            this.fullPageListening = VanillaTilt.isSettingTrue(this.settings["full-page-listening"]);
            this.gyroscope = VanillaTilt.isSettingTrue(this.settings.gyroscope);
            this.gyroscopeSamples = this.settings.gyroscopeSamples;
            this.elementListener = this.getElementListener();

            if (this.glare) {
                this.prepareGlare();
            }

            if (this.fullPageListening) {
                this.updateClientSize();
            }

            this.addEventListeners();
            this.reset();

            if (this.resetToStart === false) {
                this.settings.startX = 0;
                this.settings.startY = 0;
            }
        }

        static isSettingTrue(setting) {
            return setting === "" || setting === true || setting === 1;
        }

        getElementListener() {
            if (this.fullPageListening) {
                return window.document;
            }
            if (typeof this.settings["mouse-event-element"] === "string") {
                let listener = document.querySelector(this.settings["mouse-event-element"]);
                if (listener) {
                    return listener;
                }
            }
            return this.settings["mouse-event-element"] instanceof Node ? this.settings["mouse-event-element"] : this.element;
        }

        addEventListeners() {
            this.onMouseEnterBind = this.onMouseEnter.bind(this);
            this.onMouseMoveBind = this.onMouseMove.bind(this);
            this.onMouseLeaveBind = this.onMouseLeave.bind(this);
            this.onWindowResizeBind = this.onWindowResize.bind(this);
            this.onDeviceOrientationBind = this.onDeviceOrientation.bind(this);

            this.elementListener.addEventListener("mouseenter", this.onMouseEnterBind);
            this.elementListener.addEventListener("mouseleave", this.onMouseLeaveBind);
            this.elementListener.addEventListener("mousemove", this.onMouseMoveBind);

            if (this.glare || this.fullPageListening) {
                window.addEventListener("resize", this.onWindowResizeBind);
            }

            if (this.gyroscope) {
                window.addEventListener("deviceorientation", this.onDeviceOrientationBind);
            }
        }

        removeEventListeners() {
            this.elementListener.removeEventListener("mouseenter", this.onMouseEnterBind);
            this.elementListener.removeEventListener("mouseleave", this.onMouseLeaveBind);
            this.elementListener.removeEventListener("mousemove", this.onMouseMoveBind);

            if (this.gyroscope) {
                window.removeEventListener("deviceorientation", this.onDeviceOrientationBind);
            }

            if (this.glare || this.fullPageListening) {
                window.removeEventListener("resize", this.onWindowResizeBind);
            }
        }

        destroy() {
            clearTimeout(this.transitionTimeout);
            if (this.updateCall !== null) {
                cancelAnimationFrame(this.updateCall);
            }

            this.reset();
            this.removeEventListeners();
            this.element.vanillaTilt = null;
            delete this.element.vanillaTilt;
            this.element = null;
        }

        onDeviceOrientation(event) {
            if (event.gamma === null || event.beta === null) {
                return;
            }

            this.updateElementPosition();

            if (this.gyroscopeSamples > 0) {
                this.lastgammazero = this.gammazero;
                this.lastbetazero = this.betazero;

                if (this.gammazero === null) {
                    this.gammazero = event.gamma;
                    this.betazero = event.beta;
                } else {
                    this.gammazero = (event.gamma + this.lastgammazero) / 2;
                    this.betazero = (event.beta + this.lastbetazero) / 2;
                }

                this.gyroscopeSamples -= 1;
            }

            let totalX = this.settings.gyroscopeMaxAngleX - this.settings.gyroscopeMinAngleX;
            let totalY = this.settings.gyroscopeMaxAngleY - this.settings.gyroscopeMinAngleY;
            let xFactor = totalX / this.width;
            let yFactor = totalY / this.height;

            let clientX = event.gamma - (this.settings.gyroscopeMinAngleX + this.gammazero);
            let clientY = event.beta - (this.settings.gyroscopeMinAngleY + this.betazero);

            if (this.updateCall !== null) {
                cancelAnimationFrame(this.updateCall);
            }

            this.event = {
                clientX: clientX / xFactor + this.left,
                clientY: clientY / yFactor + this.top
            };

            this.updateCall = requestAnimationFrame(this.updateBind);
        }

        onMouseEnter() {
            this.updateElementPosition();
            this.element.style.willChange = "transform";
            this.setTransition();
        }

        onMouseMove(event) {
            if (this.updateCall !== null) {
                cancelAnimationFrame(this.updateCall);
            }

            this.event = event;
            this.updateCall = requestAnimationFrame(this.updateBind);
        }

        onMouseLeave() {
            this.setTransition();
            if (this.settings.reset) {
                requestAnimationFrame(this.resetBind);
            }
        }

        reset() {
            this.onMouseEnter();
            if (this.fullPageListening) {
                this.event = {
                    clientX: (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.clientWidth,
                    clientY: (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.clientHeight
                };
            } else {
                this.event = {
                    clientX: this.left + (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.width,
                    clientY: this.top + (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.height
                };
            }

            let scale = this.settings.scale;
            this.settings.scale = 1;
            this.update();
            this.settings.scale = scale;
            this.resetGlare();
        }

        resetGlare() {
            if (this.glare) {
                this.glareElement.style.transform = "rotate(180deg) translate(-50%, -50%)";
                this.glareElement.style.opacity = "0";
            }
        }

        getValues() {
            let percentageX, percentageY;
            if (this.fullPageListening) {
                percentageX = this.event.clientX / this.clientWidth;
                percentageY = this.event.clientY / this.clientHeight;
            } else {
                percentageX = (this.event.clientX - this.left) / this.width;
                percentageY = (this.event.clientY - this.top) / this.height;
            }

            percentageX = Math.min(Math.max(percentageX, 0), 1);
            percentageY = Math.min(Math.max(percentageY, 0), 1);

            let tiltX = (this.reverse * (this.settings.max - percentageX * this.settings.max * 2)).toFixed(2);
            let tiltY = (this.reverse * (percentageY * this.settings.max * 2 - this.settings.max)).toFixed(2);

            let angle = Math.atan2(
                this.event.clientX - (this.left + this.width / 2),
                -(this.event.clientY - (this.top + this.height / 2))
            ) * (180 / Math.PI);

            return {
                tiltX,
                tiltY,
                percentageX: 100 * percentageX,
                percentageY: 100 * percentageY,
                angle
            };
        }

        updateElementPosition() {
            let rect = this.element.getBoundingClientRect();
            this.width = this.element.offsetWidth;
            this.height = this.element.offsetHeight;
            this.left = rect.left;
            this.top = rect.top;
        }

        update() {
            let values = this.getValues();

            this.element.style.transform = `perspective(${this.settings.perspective}px) rotateX(${this.settings.axis === "x" ? 0 : values.tiltY}deg) rotateY(${this.settings.axis === "y" ? 0 : values.tiltX}deg) scale3d(${this.settings.scale}, ${this.settings.scale}, ${this.settings.scale})`;

            if (this.glare) {
                this.glareElement.style.transform = `rotate(${values.angle}deg) translate(-50%, -50%)`;
                this.glareElement.style.opacity = `${values.percentageY * this.settings["max-glare"] / 100}`;
            }

            this.element.dispatchEvent(new CustomEvent("tiltChange", { detail: values }));
            this.updateCall = null;
        }

        prepareGlare() {
            if (!this.glarePrerender) {
                let glareWrapper = document.createElement("div");
                glareWrapper.classList.add("js-tilt-glare");
                let glareInner = document.createElement("div");
                glareInner.classList.add("js-tilt-glare-inner");

                glareWrapper.appendChild(glareInner);
                this.element.appendChild(glareWrapper);
            }

            this.glareElementWrapper = this.element.querySelector(".js-tilt-glare");
            this.glareElement = this.element.querySelector(".js-tilt-glare-inner");

            if (!this.glarePrerender) {
                Object.assign(this.glareElementWrapper.style, {
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    "pointer-events": "none",
                    "border-radius": "inherit"
                });

                Object.assign(this.glareElement.style, {
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    "pointer-events": "none",
                    "background-image": "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
                    transform: "rotate(180deg) translate(-50%, -50%)",
                    "transform-origin": "0% 0%",
                    opacity: "0"
                });

                this.updateGlareSize();
            }
        }

        updateGlareSize() {
            if (this.glare) {
                let size = (this.element.offsetWidth > this.element.offsetHeight ? this.element.offsetWidth : this.element.offsetHeight) * 2;
                Object.assign(this.glareElement.style, {
                    width: `${size}px`,
                    height: `${size}px`
                });
            }
        }

        updateClientSize() {
            this.clientWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            this.clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        }

        onWindowResize() {
            this.updateGlareSize();
            this.updateClientSize();
        }

        setTransition() {
            clearTimeout(this.transitionTimeout);
            this.element.style.transition = this.settings.speed + "ms " + this.settings.easing;
            if (this.glare) {
                this.glareElement.style.transition = `opacity ${this.settings.speed}ms ${this.settings.easing}`;
            }

            this.transitionTimeout = setTimeout(() => {
                this.element.style.transition = "";
                if (this.glare) {
                    this.glareElement.style.transition = "";
                }
            }, this.settings.speed);
        }

        extendSettings(settings) {
            let defaultSettings = {
                reverse: false,
                max: 15,
                startX: 0,
                startY: 0,
                perspective: 1000,
                easing: "cubic-bezier(.03,.98,.52,.99)",
                scale: 1,
                speed: 300,
                transition: true,
                axis: null,
                glare: false,
                "max-glare": 1,
                "glare-prerender": false,
                "full-page-listening": false,
                "mouse-event-element": null,
                reset: true,
                "reset-to-start": true,
                gyroscope: true,
                gyroscopeMinAngleX: -45,
                gyroscopeMaxAngleX: 45,
                gyroscopeMinAngleY: -45,
                gyroscopeMaxAngleY: 45,
                gyroscopeSamples: 10
            };

            let newSettings = {};

            for (let property in defaultSettings) {
                if (property in settings) {
                    newSettings[property] = settings[property];
                } else if (this.element.hasAttribute("data-tilt-" + property)) {
                    let attribute = this.element.getAttribute("data-tilt-" + property);
                    try {
                        newSettings[property] = JSON.parse(attribute);
                    } catch (e) {
                        newSettings[property] = attribute;
                    }
                } else {
                    newSettings[property] = defaultSettings[property];
                }
            }

            return newSettings;
        }

        static init(elements, settings) {
            if (elements instanceof Node) {
                elements = [elements];
            }

            if (elements instanceof NodeList) {
                elements = [].slice.call(elements);
            }

            if (elements instanceof Array) {
                elements.forEach(element => {
                    if (!("vanillaTilt" in element)) {
                        element.vanillaTilt = new VanillaTilt(element, settings);
                    }
                });
            }
        }
    }

    if (typeof document !== "undefined") {
        window.VanillaTilt = VanillaTilt;
        VanillaTilt.init(document.querySelectorAll("[data-tilt]"));
    }

    return VanillaTilt;
})();
