'use strict';

define(function(require) {
    var math = require('math');
    var functionPlot = require('function-plot');
    var constants = {h: 0.001, epsilon: 0.0000001, zoom: 0.0001, round: 5}; // h used on derivatives
    var init = {
        fx: "10 * pi * ( ( x - pi ) / ( ( ( x - pi ) ^ 2 + 4 ) * ( ( x - pi ) ^ 2 + 1 ) ) ) - ( pi / 10 * atan(-x) )",
        tolerance: 0.001,
        iteration: 12,
        'newton-x': 3,
        'secant-x0': 2,
        'secant-x1': 4,
        'bisection-a': 1,
        'bisection-b': 5,
        'false-position-a': 1,
        'false-position-b': 5,
        'hybrid-a': 1,
        'hybrid-b': 5
    };

    function evaluate(fx, obj) {
        var result = fx.eval(obj);
        if (isFinite(result)) {
            return result;
        }
        else {
            var msg = "Infinity or Imaginary value reached";
            alert(msg);
            throw msg;
        };
    }

    function replaceConstants(fx) {
        return fx.replace(/(pi|PI|e|E|phi|tau)/g, function(constant) { return math[constant] })
            .replace(/h/g, function(constant) { return constants.h });
    }

    function derivative(f) {
        return '( (' + f.replace(/x/g, '(x + h)') + ') - (' + f.replace(/x/g, '(x - h)') + ') ) / (2 * h)';
    }

    function derivative2(f) {
        return '( (' + f.replace(/x/g, '(x + h)') + ') - 2 * (' + f + ') + (' + f.replace(/x/g, '(x - h)') + ') ) / h ^ 2';
    }

    function toFixed(x) {
        return x.toFixed(constants.round);
    }

    function zoomIn(plot, x, y) {
        $(plot).data('plot').programmaticZoom(getZoom(x), getZoom(y));
    }

    function zoomOut(plot) {
        var p = $(plot).data('plot');
        p.programmaticZoom(p.meta.xDomain, p.meta.yDomain);
    }

    function isAprox(points, x, y) {
        for(var i = 0; i < points.length; i++) {
            var point = points[i];
            if (toFixed(point[0]) === toFixed(x) && toFixed(point[1]) === toFixed(y))
                return point[2];
        }
        return false;
    }

    function getZoom(x) {
        return [x - constants.zoom, x + constants.zoom];
    }

    function initialize(id) {
        $(id + '-result').empty();
        $(id + '-plot').empty();
        $(id + '-zoom-out').show();
    }

    function draw(fx, fd, points, annotation, plot) {
        try {
            var config = {
                target: plot,
                width: 450,
                data: [
                    {
                        fn: replaceConstants(fx),
                        sampler: 'builtIn',
                        graphType: 'polyline'
                    },
                    {
                        points: points,
                        sampler: 'builtIn',
                        fnType: 'points',
                        graphType: 'scatter'
                    }
                ],
                annotations: [annotation],
                tip: {
                    renderer: function(x, y) {
                        var text = "(" + x.toFixed(3) + ", " + y.toFixed(3) + ")";
                        var aprox = isAprox(points, x, y);
                        return aprox ? aprox + ' ≈ ' + text : text;
                    }
                }
            };

            if(fd) {
                config.data[0].derivative = {
                    fn: replaceConstants(fd),
                    updateOnMouseMove: true
                }
            }

            $(plot).data('plot', functionPlot(config));
        }
        catch (err) {
            console.log(err);
            alert(err);
        }
    }

    function newton(obj) {
        if (obj.f !== "" && obj.x !== "" && obj.tolerance !== "" && obj.nmax !== "") {
            if(!obj.keep) initialize(obj.id);

            var scope = { x: Number(obj.x), h: constants.h }; obj.tolerance = Number(obj.tolerance); obj.nmax = Number(obj.nmax);

            var func = math.compile(obj.f);
            var deriv = math.compile(derivative(obj.f));
            var deriv2 = math.compile(derivative2(obj.f));

            var fx = evaluate(func, scope);
            var fd2 = evaluate(deriv2, scope);

            if (math.sign(fx) !== math.sign(fd2)) {
                $(obj.id + '-result').append('<label class="warning">f\'\'(' + scope.x + ') is ' + (fd2 > 0 ? 'convex' : 'concave') + ' and f(' + scope.x + ') is ' + (fx > 0 ? '> 0' : '< 0') + ' so the selected point could diverge</label><br/>');
            }

            var points = [[scope.x, fx, 'x(0)']];
            var annotation = {x: scope.x, text: 'x(0)'};
            var converged = false;
            var previous = 0;
            for(var n = 1; n <= obj.nmax; n++) {
                var fd = evaluate(deriv, scope);
                if (math.abs(fd) < constants.epsilon) {
                    break;
                }

                var delta = fx / fd;
                previous = scope.x;
                scope.x = scope.x - delta;
                fx = evaluate(func, scope);
                points.push([scope.x, fx, 'x(' + n + ')']);
                annotation.x = scope.x;
                annotation.text = 'x(' + n + ')';
                $(obj.id + '-result').append('<label>x(' + n + ')</label><span>&nbsp;' + scope.x + '&nbsp;</span><a href="javascript:zoomIn(\'' + obj.id + '-plot\', ' + scope.x + ', ' + fx + ')" title="zoom in"><span class="glyphicon glyphicon-zoom-in"></span></a><br/>');
                if(math.abs(delta) <= obj.tolerance) {
                    converged = true;
                    break;
                }
            }

            return {points: points, annotation: annotation, x: scope.x, converged: converged, error: math.abs(scope.x - previous) / math.abs(scope.x)};
        }
        else {
            alert('Missing some input field like fx, tolerance, iteration and x(0)');
        }
    }

    function secant(obj) {
        if (obj.f !== "" && obj.a !== "" && obj.b !== "" && obj.tolerance !== "" && obj.nmax !== "") {
            if(!obj.keep) initialize(obj.id);

            obj.a = Number(obj.a); obj.b = Number(obj.b); obj.tolerance = Number(obj.tolerance); obj.nmax = Number(obj.nmax) + 2;

            var func = math.compile(obj.f);
            var fa = evaluate(func, { x: obj.a });
            var fb = evaluate(func, { x: obj.b });

            if (math.abs(fa) > math.abs(fb)) {
                var aux = obj.a;
                obj.a = obj.b;
                obj.b = aux;
                aux = fa;
                fa = fb;
                fb = aux;
            }

            var a = obj.a, b = obj.b, n = obj.n ? obj.n + 2 : 2;
            var error = (obj.b - obj.a);
            var points = [[obj.a, fa, 'a'],[obj.b, fb, 'b']];
            var annotation = {};
            var converged = false;
            var previous = 0;
            for(n; n < obj.nmax; n++) {
                if (math.abs(fa) > math.abs(fb)) {
                    var aux = obj.a;
                    obj.a = obj.b;
                    obj.b = aux;
                    aux = fa;
                    fa = fb;
                    fb = aux;
                }
                var d = (obj.b - obj.a) / (fb - fa);
                obj.b = obj.a;
                fb = fa;
                d = d * fa;
                if (math.abs(d) < obj.tolerance) {
                    converged = true;
                    break;
                }

                previous = obj.a;
                obj.a = obj.a - d;
                fa = evaluate(func, { x: obj.a });
                points.push([obj.a, fa, 'x(' + n + ')']);
                annotation.x = obj.a;
                annotation.text = 'x(' + obj.a + ')';
                $(obj.id + '-result').append('<label>x(' + n + ')</label><span>&nbsp;' + obj.a + '&nbsp;</span><a href="javascript:zoomIn(\'' + obj.id + '-plot\', ' + obj.a + ', ' + fa + ')" title="zoom in"><span class="glyphicon glyphicon-zoom-in"></span></a><br/>');
            }

            return {points: points, annotation: annotation, a: obj.a, b: obj.b, converged: converged, error: math.abs(obj.a - previous) / math.abs(obj.a)};
        }
        else {
            alert('Missing some input field like fx, tolerance, iteration, a and b');
        }
    }

    function bisection(obj) {
        if (obj.f !== "" && obj.a !== "" && obj.b !== "" && obj.tolerance !== "" && obj.nmax !== "") {
            if(!obj.keep) initialize(obj.id);

            obj.a = Number(obj.a); obj.b = Number(obj.b); obj.tolerance = Number(obj.tolerance); obj.nmax = Number(obj.nmax);

            var func = math.compile(obj.f);
            var fa = evaluate(func, { x: obj.a });
            var fb = evaluate(func, { x: obj.b });

            if (math.sign(fa) === math.sign(fb)) {
                $(obj.id + '-result').append('<label class="error">Invalid interval f(' + obj.a + ') * f(' + obj.b + ') ≈ ' + toFixed(fa * fb) + ' >= 0 so no root inferred</label><br/>');
                return;
            }

            var a = obj.a, b = obj.b, n = obj.n ? obj.n : 0;
            var error = (obj.b - obj.a);
            var points = [[obj.a, fa, 'a'],[obj.b, fb, 'b']];
            var annotation = {};
            var converged = false;
            for(n; n < obj.nmax; n++) {
                error = error / 2;
                var c = obj.a + error;
                var fc = evaluate(func, { x: c });
                points.push([c, fc, 'c(' + n + ')']);
                annotation.x = c;
                annotation.text = 'c(' + n + ')';
                $(obj.id + '-result').append('<label>c(' + n + ')</label><span>&nbsp;' + c + '&nbsp;</span><a href="javascript:zoomIn(\'' + obj.id + '-plot\', ' + c + ', ' + fc + ')" title="zoom in"><span class="glyphicon glyphicon-zoom-in"></span></a><br/>');
                if (math.abs(error) < obj.tolerance) {
                    converged = true;
                    break;
                }

                if (math.sign(fa) != math.sign(fc)) {
                    obj.b = c;
                    fb = fc;
                }
                else {
                    obj.a = c;
                    fa = fc;
                }
            }

            return {points: points, annotation: annotation, a: obj.a, b: obj.b, converged: converged, error: math.abs(b - a) / math.pow(2, n + 1)};
        }
        else {
            alert('Missing some input field like fx, tolerance, iteration, a and b');
        }
    }

    function falsePosition(obj) {
        if (obj.f !== "" && obj.a !== "" && obj.b !== "" && obj.tolerance !== "" && obj.nmax !== "") {
            if(!obj.keep) initialize(obj.id);

            obj.a = Number(obj.a); obj.b = Number(obj.b); obj.tolerance = Number(obj.tolerance); obj.nmax = Number(obj.nmax);

            var func = math.compile(obj.f);
            var fa = evaluate(func, { x: obj.a });
            var fb = evaluate(func, { x: obj.b });

            if (math.sign(fa) === math.sign(fb)) {
                $(obj.id + '-result').append('<label class="error">Invalid interval f(' + obj.a + ') * f(' + obj.b + ') ≈ ' + toFixed(fa * fb) + ' >= 0 so no root inferred</label><br/>');
                return;
            }

            var a = obj.a, b = obj.b, n = obj.n ? obj.n : 0;
            var points = [[obj.a, fa, 'a'],[obj.b, fb, 'b']];
            var annotation = {};
            var converged = false;
            var c = 0;
            var previous = 0;
            for(n; n < obj.nmax; n++) {
                previous = c;
                c = (obj.a * fb - obj.b * fa) / (fb - fa);
                var fc = evaluate(func, { x: c });
                points.push([c, fc, 'c(' + n + ')']);
                annotation.x = c;
                annotation.text = 'c(' + n + ')';
                $(obj.id + '-result').append('<label>c(' + n + ')</label><span>&nbsp;' + c + '&nbsp;</span><a href="javascript:zoomIn(\'' + obj.id + '-plot\', ' + c + ', ' + fc + ')" title="zoom in"><span class="glyphicon glyphicon-zoom-in"></span></a><br/>');

                if (math.abs(fc) < obj.tolerance) {
                    converged = true;
                    break;
                }

                if (math.sign(fa) != math.sign(fc)) {
                    obj.b = c;
                    fb = fc;
                }
                else {
                    obj.a = c;
                    fa = fc;
                }
            }

            return {points: points, annotation: annotation, a: obj.a, b: obj.b, converged: converged, error: math.abs(c - previous) / math.abs(c)};
        }
        else {
            alert('Missing some input field like fx, tolerance, iteration, a and b');
        }
    }

    function hybrid(obj) {
        if (obj.f !== "" && obj.a !== "" && obj.b !== "" && obj.tolerance !== "" && obj.nmax !== "" && obj.algorithm !== "") {
            initialize(obj.id);

            obj.a = Number(obj.a); obj.b = Number(obj.b); obj.tolerance = Number(obj.tolerance); obj.nmax = Number(obj.nmax); obj.algorithm = eval($(obj.algorithm).val());

            var func = math.compile(obj.f);
            var fa = evaluate(func, { x: obj.a });
            var fb = evaluate(func, { x: obj.b });

            if (math.sign(fa) === math.sign(fb)) {
                $(obj.id + '-result').append('<label class="error">Invalid interval f(' + obj.a + ') * f(' + obj.b + ') ≈ ' + toFixed(fa * fb) + ' >= 0 so no root inferred</label><br/>');
                return;
            }

            var points = [];
            var annotation = {};
            var deriv = math.compile(derivative(obj.f));
            var converged = false;
            var error = 0;
            for(var n = 0; n < obj.nmax; n++) {
                var fda = evaluate(deriv, { x: obj.a, h: constants.h });
                var fdb = evaluate(deriv, { x: obj.b, h: constants.h });
                var result = null;

                if (math.sign(fda) === math.sign(fdb) && math.sign(fda) !== math.sign(fa)) {
                    var deriv2 = math.compile(derivative2(obj.f));
                    var fda2 = evaluate(deriv2, { x: obj.a, h: constants.h });
                    if (math.sign(fa) === math.sign(fda2)) {
                        obj.x = obj.a
                    }
                    else {
                        var fdb2 = evaluate(deriv2, { x: obj.b, h: constants.h });
                        if (math.sign(fb) === math.sign(fdb2)) {
                            obj.x = obj.b
                        }
                    }
                    if (obj.x) {
                        obj.nmax = obj.nmax - n;
                        result = newton(obj);
                        if(!result) return;
                        points = points.concat(result.points);
                        annotation = result.annotation;
                        converged = result.converged;
                        error = result.error;
                        break;
                    }
                }

                var obj2 = $.extend(true, {}, obj);
                obj2.n = n;
                obj2.nmax = n + 1;
                result = obj.algorithm(obj2);
                if(!result) return;
                obj.a = result.a;
                obj.b = result.b;
                points = points.concat(result.points);
                annotation = result.annotation;
                if(result.converged) {
                    converged = result.converged;
                    error = result.error;
                    break;
                }
            }

            return {points: points, annotation: annotation, converged: converged, error: error};
        }
        else {
            alert('Missing some input field like fx, tolerance, iteration, a and b');
        }
    }

    // bind on change listener to calculate methods
    function initListeners() {
        for(var key in init) {
            $('#' + key).val(init[key]);
        }

        $('#newton-calculate').click(function() {
            var obj = {f: $('#fx').val(), tolerance: $('#tolerance').val(), nmax: $('#iteration').val(), x: $('#newton-x').val(), id: '#newton'};
            var result = newton(obj);
            if (result) {
                $(obj.id + '-result').append('<label class="' + (result.converged ? 'converged' : 'diverged') +'">' + (result.converged ? 'Converged' : 'Diverged') + ' (error = ' + result.error + ')</label><br/>');
                draw(obj.f, derivative(obj.f), result.points, result.annotation, obj.id + '-plot');
            }
        });
        $('#secant-calculate').click(function() {
            var obj = {f: $('#fx').val(), tolerance: $('#tolerance').val(), nmax: $('#iteration').val(), a: $('#secant-x0').val(), b: $('#secant-x1').val(), id: '#secant'};
            var result = secant(obj);
            if (result) {
                $(obj.id + '-result').append('<label class="' + (result.converged ? 'converged' : 'diverged') +'">' + (result.converged ? 'Converged' : 'Diverged') + ' (error = ' + result.error + ')</label><br/>');
                draw(obj.f, null, result.points, result.annotation, obj.id + '-plot');
            }
        });
        $('#bisection-calculate').click(function() {
            var obj = {f: $('#fx').val(), tolerance: $('#tolerance').val(), nmax: $('#iteration').val(), a: $('#bisection-a').val(), b: $('#bisection-b').val(), id: '#bisection'};
            var result = bisection(obj);
            if (result) {
                $(obj.id + '-result').append('<label class="' + (result.converged ? 'converged' : 'diverged') +'">' + (result.converged ? 'Converged' : 'Diverged') + ' (error = ' + result.error + ')</label><br/>');
                draw(obj.f, null, result.points, result.annotation, obj.id + '-plot');
            }
        });
        $('#false-position-calculate').click(function() {
            var obj = {f: $('#fx').val(), tolerance: $('#tolerance').val(), nmax: $('#iteration').val(), a: $('#false-position-a').val(), b: $('#false-position-b').val(), id: '#false-position'};
            var result = falsePosition(obj);
            if (result) {
                $(obj.id + '-result').append('<label class="' + (result.converged ? 'converged' : 'diverged') +'">' + (result.converged ? 'Converged' : 'Diverged') + ' (error = ' + result.error + ')</label><br/>');
                draw(obj.f, null, result.points, result.annotation, obj.id + '-plot');
            }
        });
        $('#hybrid-calculate').click(function() {
            var obj = {f: $('#fx').val(), tolerance: $('#tolerance').val(), nmax: $('#iteration').val(), a: $('#hybrid-a').val(), b: $('#hybrid-b').val(), id: '#hybrid', keep: true, algorithm: '#algorithm'};
            var result = hybrid(obj);
            if (result) {
                $(obj.id + '-result').append('<label class="' + (result.converged ? 'converged' : 'diverged') +'">' + (result.converged ? 'Converged' : 'Diverged') + ' (error = ' + result.error + ')</label><br/>');
                draw(obj.f, derivative(obj.f), result.points, result.annotation, obj.id + '-plot');
            }
        });
    }

    // initialize listeners
    initListeners();

    window.zoomIn = zoomIn;
    window.zoomOut = zoomOut;
});