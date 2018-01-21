var json = "";
var view = "1.json";

var blinkAlert = [];

var odometer;
var odometerTimer;

var dashboardVisible = [];
var dashboardHidden = [];
var adjustHeight;

var stream = "";
var streamHttpRequest;
var streamTimer;

var _alert;

document.addEventListener("DOMContentLoaded", function(event)
{
    _alert = document.getElementById("alert");

    loadView("views/" + view, function(data)
    {
        //console.log(data);
        json = data;

        document.body.style.backgroundImage = "url('views/bg/" + data.background + "')"; 

        buildView("front");
        renderView("front");
        animateView();

        setTimeout(function() {
            streamInit();
        }, 4000);

    }, function(xhr) { console.error(xhr); });
});

function animateView()
{
    document.gauges.forEach(function(gauge) {

        if (gauge.options.enabled == true)
        {
            //console.log("... animate " + gauge.options.renderTo);

            gauge.value = gauge.options.maxValue;

            setTimeout(function() {
                gauge.value = gauge.options.minValue;
            }, gauge.options.animationDuration*1.5);
        }
    });

    //new SVGInjector().inject(document.querySelectorAll("img.svg-inject"));
};

function sizeView(view)
{
    if(view === "front")
    {
        var h = 100; //TODO: calculate dynamically
        adjustHeight = h;
        //dashboardHeight = (getHeight() - adjustHeight);
        //console.log("dashboardHeight: " + dashboardHeight);

        if(json.alerts.odometer.enabled === true)
            h *=2;

        for (var i = 0, l = document.gauges.length; i < l; i++) {

            var gauge = document.gauges[i];
            //console.log(gauge);

            if (gauge.options.enabled == true) {

                //console.log("... adjust size " + gauge.options.renderTo);

                gauge.options.width = Math.round(getWidth() / dashboardVisible.length); // * gauge.options.width);
                gauge.options.height = Math.round(getHeight() - h) ; //dashboardVisible.length);// * gauge.options.height);
                gauge.update();

                var td = document.getElementById(gauge.options.renderTo);
                td.parentElement.width = gauge.options.width;
                td.parentElement.height = gauge.options.height;
            //}else {
            }
        }

        /*
        var maxH = [];
        for (var i = 0; i < json.dashboard.length; i++)
        {
            var t = document.getElementById("canvasIndex" + i);
            console.log("canvasIndex" + i + " height=" + t.height);
            maxH.push(t.height);
        }
        dashboardHeight = Math.max.apply(null,maxH);
        */

    }else if (view === "back") {

        var divA = document.getElementById("backAvailable");
        var divB = document.getElementById("backSelected");
        
        divA.parentElement.height = Math.round(getHeight() / 3);
        divB.parentElement.height = getHeight() - divA.parentElement.height - adjustHeight;

        for (var i = 0; i < json.dashboard.length; i++)
        {
            var img = document.getElementById("_" + json.dashboard[i].renderTo);
            img.width = img.parentElement.parentElement.parentElement.parentElement.height;
        }
    }
};

function buildOdometer(view)
{
    //var odometer = CANRead("distance");

    clearTimeout(odometerTimer);
    
    var tr = document.getElementById(view + "Odometer");
    tr.innerHTML = "";

    console.log("... build odometer " + json.alerts.odometer.enabled);

    if(json.alerts.odometer.enabled === true)
    {
        var td = document.createElement("td");
        td.colSpan = json.dashboard.length;

        var canvasOdometer = document.createElement("canvas");
        canvasOdometer.id = "odometer";
        //canvasOdometer.style="position:relative; top:-" + (getHeight() - dashboardHeight) + "px;";
        canvasOdometer.height = adjustHeight-10;

        td.appendChild(canvasOdometer);
        tr.appendChild(td);

        odometer = new SegmentDisplay("odometer");
        odometer.pattern = json.odometer.pattern;
        odometer.colorOn = json.odometer.colorOn;
        odometer.colorOff = json.odometer.colorOff;
        odometer.draw();
        odometer.setValue(json.odometer.count);

        updateOdometer(parseFloat(json.odometer.count));
    }
};

function buildAlerts(view)
{
    //console.log("alert icon height = " + adjustHeight + " | average view height = " + dashboardHeight);

    var alerts = document.getElementById(view + "Alerts");
    alerts.innerHTML = "";

    if(view === "front")
    {
        var td = buildAlertList(false, adjustHeight - 20);
        td.colSpan = json.dashboard.length;

        //fixes flip rotation for svg
        for (var i = 0, l = td.childNodes.length; i < l; i++)
            td.childNodes[i].style="";

    }else if (view === "back") {

        var td = buildAlertList(true, adjustHeight / 2);
    }

    alerts.appendChild(td);

    new SVGInjector().inject(document.querySelectorAll(".svg-inject"));
    //SVGInjector(document.querySelectorAll('.svg-inject'));
};

function buildView(view)
{
    var side = document.getElementsByClassName(view);
    var table = document.createElement("table");
    var tr = document.createElement("tr");

    table.id = view + "Table";

    if(view === "front")
    {
        for (var i = 0, l = json.dashboard.length; i < l; i++)
        {
            var td = document.getElementById( "canvasIndex" + i);

            if (!(td instanceof HTMLCanvasElement)) {

                var td = document.createElement("td");
                td.id = "canvasIndex" + i;
                tr.appendChild(td);

                json.dashboard[i].width = Math.round(getWidth()/3);
                json.dashboard[i].height = json.dashboard[i].width;
            }
        }

        side[0].onclick = function () {

            _alert.style.display = "none";

            streamHttpRequest.abort();
            clearTimeout(streamTimer);

            buildView("back");
            renderView("back");

            this.parentElement.style.cssText = "transform:rotateX(180deg); -webkit-transform:rotateX(180deg);";
            for (var i = 0, l = blinkAlert.length; i < l; i++)
                clearInterval(blinkAlert[i]);
            blinkAlert = [];
        };

    }else if (view === "back") {

        var divA = document.createElement("div");
        var divB = document.createElement("div");
        var table = document.createElement("table");

        divA.id = view + "Available";
        divB.id = view + "Selected";

        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.appendChild(divA);
        tr.appendChild(td);
        table.appendChild(tr);

        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.appendChild(divB);
        tr.appendChild(td);

        side[0].onclick = function () {
            //console.log(this);
            _alert.style.display = "none";

            renderView("front");

            setTimeout(function(){
                side[0].innerHTML = "";
                animateView();
                saveView();
                setTimeout(function() {
                    streamView();
                }, 4000);
            }, 1000);
            this.parentElement.style.cssText = "";
        };
    }

    table.appendChild(tr);

    var tr = document.createElement("tr");
    tr.id = view + "Odometer";
    table.appendChild(tr);

    var tr = document.createElement("tr");
    tr.id = view + "Alerts";
    table.appendChild(tr);

    side[0].appendChild(table);
};

function renderView(view)
{
    //console.log(json);

    if(view === "front")
    {
        stream = "din_ocur";
        dashboardVisible = [];
        dashboardHidden = [];

        var front = document.getElementsByClassName("front");

        for (var i = 0, l = json.dashboard.length; i < l; i++)
        {
            var render = document.getElementById(json.dashboard[i].renderTo);
            var td = document.getElementById("canvasIndex" + json.dashboard[i].index);

            if(json.dashboard[i].enabled)
            {
                //console.log(json.dashboard[i].renderTo);

                switch (json.dashboard[i].renderTo) {
                    case "udc":
                    stream += ",udc,udcmax";
                    break;
                case "speed":
                    stream += ",speed";
                    break;
                case "temp":
                    stream += ",tmpm,tmphs";
                    break;
                }

                if (render instanceof HTMLCanvasElement)
                {
                    //if element exists we want to verify canvasindex is correct
                    //console.log(render.parentElement.id + " > " + json.dashboard[i].index);

                    if(render.parentElement.id !== "canvasIndex" + json.dashboard[i].index)
                    {
                        console.log("index incorrect ...moving canvas");

                        render.parentElement.width = 0;
                        render.remove();
                        td.appendChild(render);
                    }

                }else{
                    //console.log(JSON.stringify(json.dashboard[i],null, 2));

                    var canvas = document.createElement("canvas");
                    canvas.id = json.dashboard[i].renderTo;
                    td.appendChild(canvas);

                    new RadialGauge(json.dashboard[i]).draw();
                }

                dashboardVisible.push(json.dashboard[i]);

            }else{

                if (render instanceof HTMLCanvasElement) {
                    //console.log("...hide canvas " + json.dashboard[i].renderTo);
                    render.parentElement.width = 0;
                    render.remove();
                }

                dashboardHidden.push(json.dashboard[i]);
            }
        }

        sizeView(view);

        buildOdometer(view);

        /*
        for (i in json.sounds)
        {
            if(json.sounds[i].play)
            {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "sounds/" + json.sounds[i].id, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = function(e){
                    window.addEventListener("keydown", createPitchStep(json.sounds[i].pitchStep))
                    window.addEventListener("keyup", createPitchStep(-json.sounds[i].pitchStep))
                    engineStart(this.response);
                };
                xhr.send();
                break;
            }
        }
        */
        
    }else if (view === "back") {

        var divA = document.getElementById("backAvailable");
        var divB = document.getElementById("backSelected");

        divA.appendChild(buildGaugeList(dashboardHidden,(getHeight()/2)));
        divB.appendChild(buildGaugeList(dashboardVisible,(getHeight()/2)));

        [].forEach.call(divA.getElementsByClassName('tile__list'), function (el){
            Sortable.create(el, {
                group: 'photo',
                animation: 150,
                /*
                onChoose: function (evt) {
                    evt.item.setAttribute('width', "16%");
                },
                */
                onAdd: function (event) {
 
                    event.item.width = divA.parentElement.height;

                    sortView(el, event, false);
                    //renderView("front");
                }
            });
        });
        [].forEach.call(divB.getElementsByClassName('tile__list'), function (el){
            Sortable.create(el, {
                group: 'photo',
                animation: 150,
                /*
                onChoose: function (evt) {
                    evt.item.setAttribute('width', "24%");
                },
                */
                onAdd: function (event) {
                    //event.from;
                    event.item.width = divB.parentElement.height;

                    sortView(el, event, true);
                    //renderView("front");
                },
                //onUpdate: function (event) {
                onSort: function (event) {

                    sortView(el, event, true);
                    //renderView("front");
                }
            });
        });

        sizeView(view);
    }
    
    buildAlerts(view);
};

function sortView(el, event, enabled)
{
    for (var e = 0; e < el.children.length; e++)
    {
        for (i in json.dashboard)
        {
            if ("_" + json.dashboard[i].renderTo === el.children[e].id)
            {
                //console.log(el.children[e].id + ":" + e);
                
                json.dashboard[i].index = e;
                json.dashboard[i].enabled = enabled;
                break;
            }
        }

        for (var i = 0, l = document.gauges.length; i < l; i++)
        {
            var gauge = document.gauges[i];
            if ("_" + gauge.options.renderTo == el.children[e].id) {
                gauge.options.index = e;
                gauge.options.enabled = enabled;
                break;
            }
        }
    }
    //console.log(event.item.id);
    //console.log(event.newIndex);
};

function buildAlertList(showAll,size)
{
    var td = document.createElement("td");

    for (var key in json.alerts)
    {
        //console.log(json.alerts[i].svg);
        if((json.alerts[key].show == true && json.alerts[key].enabled == true) || showAll) {
            
            if(showAll === false)
                switch (key) {
                    case "emergency":
                    stream += ",din_emcystop";
                    break;
                }

            var span = document.createElement("span");
            var svg = document.createElement("img");
            var x = size / 2;

            if(showAll)
                x = size / 3;

            svg.dataset.color = json.alerts[key].color;
            svg.classList.add("svg-inject");
            svg.classList.add("svg-grey");
            svg.style.width = size + "px";
            svg.style.height = size + "px";
            svg.src = "img/" + key + ".svg";
            //svg.setAttribute("data-fallback", "img/" + json.alerts[i].id + ".png");
            span.style.position = "relative"; 
            span.style.zIndex = "1";
            span.id = "alert_" + key;
            span.appendChild(svg);

            span.onclick = function (e) {
                //console.log(this);
                //console.log(this.children[1].src);
                e.preventDefault();
                e.stopPropagation();

                if(this.children[1].src.indexOf("disabled") !== -1)
                {
                    json.alerts[this.id.substr(6)].enabled = true;

                    this.children[1].src = "img/enabled.svg";

                    var lightboxBody = document.getElementById("lightboxBody");
                    var lightboxTitle = document.getElementById("lightboxTitle");
                    lightboxBody.innerHTML = ""; //empty

                    if(this.id =="alert_background")
                    {
                        var ul = document.createElement("ul");
                        ul.classList.add("slides");

                        //TODO: loop through all background
                        loadView("views/bg/index.json", function(data)
                        {
                            var nav_dots = document.createElement("li");
                            nav_dots.classList.add("nav-dots");

                            for (var u = 0; u < data.index.length; u++)
                            {
                                var div = document.createElement("div");
                                var li = document.createElement("li");
                                var nav = document.createElement("div");
                                var label_prev = document.createElement("label");
                                var label_next = document.createElement("label");
                                var label = document.createElement("label");
                                var input = document.createElement("input");
                                var img = document.createElement("img");

                                div.classList.add("slide");
                                li.classList.add("slide-container");
                                nav.classList.add("nav");
                                label.classList.add("nav-dot");
                                label_prev.classList.add("prev");
                                label_next.classList.add("next");
                                
                                var input = document.createElement("input");
                                input.type = "radio";
                                input.name = "radio-btn";
                                input.id = "img-" + u;
                                input.checked = true;

                                img.src = "views/bg/" + data.index[u].file;
                                div.appendChild(img);
                                li.appendChild(div);

                                label.setAttribute("for", "img-" + u);
                                label.id = "img-dot-" + u;
                                
                                let prev = (u-1);
                                if(u == 0)
                                    prev = (data.index.length-1);
                                label_prev.innerHTML = "&#x2039";
                                label_prev.setAttribute("for", "img-" + prev);
                                nav.appendChild(label_prev);

                                let next = (u+1);
                                if(u == data.index.length-1)
                                    next = 0;
                                label_next.innerHTML = "&#x203a;";
                                label_next.setAttribute("for", "img-" + next);
                                nav.appendChild(label_next);

                                li.appendChild(nav);
                                ul.appendChild(input);
                                ul.appendChild(li);

                                img.onclick = function (e) {
                                    //console.log(this.src);
                                    json.background = this.src;
                                    document.body.style.backgroundImage = "url('views/bg/" + this.src + "')";
                                    window.location = "#close";
                                };
                            }
                            ul.appendChild(nav_dots);
                        });

                        lightboxBody.appendChild(ul);

                        window.location = "#openModal";
                    }
                    else if(this.id =="alert_odometer")
                    {
                        var textarea = document.createElement("textarea");
                        textarea.rows = "20";
                        textarea.value = JSON.stringify(json.odometer, null, 2);
                        lightboxBody.appendChild(textarea);

                        window.location = "#openModal";
                    }
                    else if(this.id =="alert_rfid")
                    {
                        var textarea = document.createElement("textarea");
                        lightboxTitle.innerHTML = "RFID Unlock";
                        textarea.rows = "20";
                        textarea.placeholder = "Unlock Codes (MIFARE Protocol 13.56 Mhz)";
                        lightboxBody.appendChild(textarea);

                        window.location = "#openModal";
                    }
                    else if(this.id =="alert_wifi-ap")
                    {
                        var ssid = document.createElement("input");
                        var ip = document.createElement("input");
                        var password = document.createElement("input");

                        lightboxTitle.innerHTML = "WiFi Access Point";
                        ssid.type = "text";
                        ip.type = "text";
                        password.type = "password";

                        ssid.placeholder = "Access Point Name (SSID)";
                        ip.placeholder = "Access Point IP (/24)";
                        password.placeholder = "Access Point Password (WPA2)";

                        lightboxBody.appendChild(ssid);
                        lightboxBody.appendChild(ip);
                        lightboxBody.appendChild(password);

                        window.location = "#openModal";
                    }
                    else if(this.id =="alert_wifi-alarm")
                    {
                        var email = document.createElement("input");
                        var smtp = document.createElement("input");
                        var username = document.createElement("input");
                        var password = document.createElement("input");

                        lightboxTitle.innerHTML = "WiFi Alarm Notification";
                        email.type = "text";
                        smtp.type = "text";
                        username.type = "text";
                        password.type = "password";

                        email.placeholder = "Email";
                        smtp.placeholder = "Email Server (SMTP)";
                        username.placeholder = "Email Username";
                        password.placeholder = "Email Password";

                        email.value = json.wifi.email;
                        smtp.value = json.wifi.smtp;
                        username.value = json.wifi.username;
                        password.value = json.wifi.password;

                        lightboxBody.appendChild(email);
                        lightboxBody.appendChild(smtp);
                        lightboxBody.appendChild(username);
                        lightboxBody.appendChild(password);

                        window.location = "#openModal";
                        /*
                        save.onclick = function (e) {

                            json.wifi.email = email.value;
                            json.wifi.smtp = smtp.value;
                            json.wifi.username = username.value;
                            json.wifi.password = password.value;

                            window.location = "#close";
                        };
                        */
                    }

                }else{
                    json.alerts[this.id.substr(6)].enabled = false;
                    this.children[1].src = "img/disabled.svg";
                }

                console.log("...set alert '" + this.id.substr(6) + "' " + json.alerts[this.id.substr(6)].enabled);

                //buildOdometer("front");
                //buildAlerts("front");
            };

            if(showAll)
            {
                var overlay = document.createElement("img");
                overlay.classList.add("svg-inject");
                if(json.alerts[key].enabled)
                {
                    overlay.src = "img/enabled.svg";
                }else{
                    overlay.src = "img/disabled.svg";
                }
                overlay.style.cssText = "position:relative;top:" + x + "px;left:-" + x + "px;width:" + x + "px;height:" + x + "px;";
                span.appendChild(overlay);
            }

            td.appendChild(span);
        }
    }

    return td;
};

function buildGaugeList(array,size,title)
{
    var tile = document.createElement("div");
    tile.classList.add("tile");
    //tile.dataset.force = array.length;
    var tile_list = document.createElement("div");
    tile_list.classList.add("tile__list");

    if(title)
    {
        var tile_name = document.createElement("div");
        tile_name.classList.add("tile__name");
        tile_name.textContent = title;
        //tile_name.style.display = "none";
        tile.appendChild(tile_name);
    }
    
    var back = document.getElementsByClassName("back");
    
    for (var i = 0; i < array.length; i++) {

        var e = array[i].enabled;

        array[i].enabled = false; //does not put these into active gauge list
        array[i].renderTo = "_" + array[i].renderTo; //set temporary id

        var canvas = document.createElement("canvas");
        canvas.id = array[i].renderTo;

        back[0].appendChild(canvas);
        var gauge = new RadialGauge(array[i]).draw();
        canvas.remove();

        var ctx = canvas.getContext('2d');
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        img.id = array[i].renderTo;
        img.width = size;
        tile_list.appendChild(img);

        img.onclick = function (e) {

            e.preventDefault();
            e.stopPropagation();

            var lightboxBody = document.getElementById("lightboxBody");
            lightboxBody.innerHTML = ""; //empty

            var code = document.createElement("textarea");
            code.rows = "20";
            code.id = "code" + this.id;

            for (i in json.dashboard)
            {
                if("_" + json.dashboard[i].renderTo === this.id)
                {
                    code.value = JSON.stringify(json.dashboard[i], null, 2);
                    break;
                }
            }
            lightboxBody.appendChild(code);

            window.location = "#openModal";

            code.onchange = function (e) {

                //console.log(this.value);

                for (i in json.dashboard)
                {
                    if("code_" + json.dashboard[i].renderTo === this.id)
                    {
                        json.dashboard[i] = JSON.parse(this.value);
                        break;
                    }
                }
                //renderView("front");
            };
        };

        //set options back
        array[i].enabled = e;
        array[i].renderTo = array[i].renderTo.substr(1);
    }

    tile.appendChild(tile_list);

    return tile;
};

function streamInit()
{
    //console.log("serial.php?init=1");

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {

            var error = "";

            if (xhr.status === 200) {

                console.log(xhr.responseText);
                error = xhr.responseText;

                if(error.indexOf("Unknown command sequence") != -1) {
                    streamView();
                    return;
                }
            } else {
                console.log(xhr.statusText);
                error = xhr.statusText;
            }
            _alert.innerHTML = "Cannot Initialize Serial " + error;
            _alert.style.display = "block";
        }
    }

    xhr.timeout = 6000;
    xhr.open('GET', "serial.php?init=1",true);
    xhr.send();
};

function streamReset(pid)
{
    //console.log("serial.php?reset=1&pid=" + pid);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                console.log(xhr.responseText);
            } else {
                console.log(xhr.statusText); 
            }
        }
    }

    xhr.timeout = 1000;
    xhr.open('GET', "serial.php?reset=1&pid=" + pid,true);
    xhr.send();
};

function getGaugeID(id)
{
    for (var i = 0, l = document.gauges.length; i < l; i++) {
        var gauge = document.gauges[i];
        if (gauge.options.renderTo == id) {
            return i;
        }
    }
};

function setColorAlert(id, color)
{
    var span = document.getElementById("alert_" + id);
    var svg = span.childNodes[0];

    svg.classList.remove("svg-grey");
    svg.classList.remove("svg-orange");
    svg.classList.remove("svg-green");
    svg.classList.add("svg-" + color);
}

function setBlinkAlert(i, id)
{
    //clearInterval(blinkAlert[i]);

    blinkAlert[i] = setInterval(function()
    {
        var span = document.getElementById("alert_" + id);
        var svg = span.childNodes[0];

        //console.log(svg.className + ":" + svg.dataset.color);
        
        if(svg.className.baseVal.indexOf(svg.dataset.color) !== -1) {
            svg.classList.remove(svg.dataset.color);
            svg.classList.add("svg-grey");
        }else{
            svg.classList.remove("svg-grey");
            svg.classList.add(svg.dataset.color);
        }

        //new SVGInjector().inject(svg);
        //SVGInjector(svg);

    }, 1000);
};

function streamView()
{
    //TODO: Detect idle mode and slow down stream

    clearTimeout(streamTimer);

    console.log("serial.php?stream=" + stream);

    streamHttpRequest = new XMLHttpRequest();
    streamHttpRequest.items = stream.split(",");
    streamHttpRequest.i = 0;
    streamHttpRequest.last = (streamHttpRequest.items.length - 1);
    streamHttpRequest.gaugeid = [stream.length];
    streamHttpRequest.delay = 640;
    streamHttpRequest.timeoutCount = 0;

    for (var i = 0; i < stream.length; i++)
    {
        streamHttpRequest.gaugeid[i] = getGaugeID(streamHttpRequest.items[i]);
        //console.log("gauge is search for " + streamHttpRequest.items[i] + " = " + streamHttpRequest.gaugeid[i]);
    }

	streamHttpRequest.onreadystatechange = function()
	{
        //console.log("State change: "+ streamHttpRequest.readyState);

        if(streamHttpRequest.readyState == 3) {

            var newData = streamHttpRequest.response.substr(streamHttpRequest.seenBytes);
            //console.log(newData + "\n-------------");

            if (newData.indexOf("Error") != -1) {

                if (newData.indexOf("<?php") != -1) {
                    _alert.innerHTML = "PHP Not Found";
                }else{
                    _alert.innerHTML = newData;
                }
                _alert.style.display = "block";

                streamHttpRequest.abort();

            } else {

                var data = newData.slice(0, -1).split("\n");

                //console.log(data);
                //console.log(this.items);

                for (var d = 0; d < data.length; d++)
                {
                    //console.log("[" + this.i + ":" + data.length + "] " + this.items[this.i] + ":" + data[d]);

                    if(this.items[this.i] === "udc")
                    {
                        //console.log(data[d] + ":" + data[d+1]);
                        var percent = parseInt(data[d]) / parseInt(data[d+1]) * 100;

                        if(percent > 0)
                        {
                            if(json.alerts.battery.show)
                            {
                                if(percent < 20) {
                                
                                    if(blinkAlert[0] === undefined)
                                    {
                                        console.log("battery: " + data[d]);
                                        setBlinkAlert(0, "battery");
                                    }
                                }else if(percent > 80) {
                                    setColorAlert("battery", "green");
                                }else if(percent > 20 && percent < 80) {
                                    setColorAlert("battery", "orange");
                                }else{
                                    clearInterval(blinkAlert[0]);
                                    setColorAlert("battery", "grey");
                                }
                            }
                            //console.log("battery: " + percent + "%");
                            document.gauges[this.gaugeid[this.i]].value = percent;
                        }

                    }else if(this.items[this.i] === "speed") {

                        document.gauges[this.gaugeid[this.i]].value = data[d];

                    }else if(this.items[this.i] === "din_emcystop" && json.alerts.emergency.show) {
                        
                        if(data[d] === "1.00") {
                            if(blinkAlert[1] === undefined)
                            {
                                console.log("emergency: " + data[d]);
                                setBlinkAlert(1, "emergency");
                            }
                        }else{
                            clearInterval(blinkAlert[1]);
                        }
                    }
                    
                    if (this.i == this.last)
                        this.i = 0;
                    else
                        this.i++;
                }
               
                /*
                var svg = document.getElementById("battery");
                svg.classList.add(svg.dataset.color);
                new SVGInjector().inject(svg);
                */
			}
			streamHttpRequest.seenBytes = streamHttpRequest.responseText.length;

            //console.log("seenBytes: " + streamHttpRequest.seenBytes);

		} else if (streamHttpRequest.readyState == 4) {

            //console.log("Complete");

            if (streamHttpRequest.status === 200) {

                //console.log(streamHttpRequest.responseText);
                
                streamTimer = setTimeout(function() {
                    streamView();
                }, this.delay);
                
            } else {

                console.log(streamHttpRequest.status);

                //if (streamHttpRequest.seenBytes) {
                //    _alert.innerHTML = "Connection Lost";
                //    _alert.style.display = "block";
                //}
            }
		}
	};

    streamHttpRequest.ontimeout = function () {
        //console.log("Reset PID: " + pid);
        //streamReset(pid);

        console.log("Timed Out");

        if(this.timeoutCount > 5)
        {
            this.timeoutCount = 0;

            _alert.innerHTML = "Connection Lost";
            _alert.style.display = "block";

        }else{
            streamTimer = setTimeout(function() {
                streamView();
            }, this.delay);

            this.timeoutCount++;
        }
    };

    streamHttpRequest.timeout = 10000;
    streamHttpRequest.open('GET', "serial.php?stream=" + stream + "&loop=800&delay=" + streamHttpRequest.delay, true);
    streamHttpRequest.send();
};

function loadView(path, success, error)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", path, true);
    //xhr.setRequestHeader('Content-Type', 'application/json'); 
    xhr.send();

    xhr.onreadystatechange = function()
    {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
					if(path.indexOf(".json") !== -1) {
						success(JSON.parse(xhr.responseText));
					}else{
						success(xhr.responseText);
					}
            } else {
                if (error)
                    error(xhr);
            }
        }
    };
};

function saveView()
{   
    console.log("saving view");

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'views/save.php', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.onload = function () {
        //console.log(this.responseText);
        if(this.responseText !== "")
        {
            _alert.innerHTML = this.responseText;
            _alert.style.display = "block";
        }
    };
    xhr.send('view=' + view + '&json=' + JSON.stringify(json));
};

function getWidth() {
  return Math.max(
    document.body.scrollWidth,
    //document.documentElement.scrollWidth,
    //document.body.offsetWidth,
    //document.documentElement.offsetWidth,
    //document.documentElement.clientWidth
  );
};

function getHeight() {
  return Math.max(
    //document.body.scrollHeight,
    //document.documentElement.scrollHeight,
    //document.body.offsetHeight,
    //document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );
};

function updateOdometer(n) {
    n += 0.01
    odometer.setValue(n.toString());
    odometerTimer = setTimeout(function(){
        updateOdometer(n);
    }, 200);
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var dLat = (lat2 - lat1).toRad();
  var dLon = (lon2 - lon1).toRad();
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  var d = R * c;
  return d;
};

Number.prototype.toRad = function() {
  return this * Math.PI / 180;
};
