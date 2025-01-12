// travel forecast display
/* globals WeatherDisplay, utils, STATUS, UNITS, draw, navigation, icons, luxon, TravelCities */

// eslint-disable-next-line no-unused-vars
class TravelForecast extends WeatherDisplay {
	constructor(navId, elemId, defaultActive) {
		// special height and width for scrolling
		super(navId, elemId, 'Travel Forecast', defaultActive);
		// pre-load background image (returns promise)
		this.backgroundImage = utils.image.load('images/BackGround6_1.png');

		// height of one city in the travel forecast
		this.cityHeight = 72;

		// set up the timing
		this.timing.baseDelay = 20;
		// page sizes are 4 cities, calculate the number of pages necessary plus overflow
		const pagesFloat = TravelCities.length / 4;
		const pages = Math.floor(pagesFloat) - 2; // first page is already displayed, last page doesn't happen
		const extra = pages % 1;
		const timingStep = this.cityHeight * 4;
		this.timing.delay = [150 + timingStep];
		// add additional pages
		for (let i = 0; i < pages; i += 1) this.timing.delay.push(timingStep);
		// add the extra (not exactly 4 pages portion)
		if (extra !== 0) this.timing.delay.push(Math.round(this.extra * this.cityHeight));
		// add the final 3 second delay
		this.timing.delay.push(150);
	}

	async getData() {
		// super checks for enabled
		if (!super.getData()) return;
		const forecastPromises = TravelCities.map(async (city) => {
			try {
				// get point then forecast
				const point = await utils.weather.getPoint(city.Latitude, city.Longitude);
				const forecast = await utils.fetch.json(point.properties.forecast);
				// determine today or tomorrow (shift periods by 1 if tomorrow)
				const todayShift = forecast.properties.periods[0].isDaytime ? 0 : 1;
				// return a pared-down forecast
				return {
					today: todayShift === 0,
					high: forecast.properties.periods[todayShift].temperature,
					low: forecast.properties.periods[todayShift + 1].temperature,
					name: city.Name,
					icon: icons.getWeatherRegionalIconFromIconLink(forecast.properties.periods[todayShift].icon),
				};
			} catch (e) {
				console.error(`GetTravelWeather for ${city.Name} failed`);
				console.error(e.status, e.responseJSON);
				return { name: city.Name };
			}
		});

		// wait for all forecasts
		const forecasts = await Promise.all(forecastPromises);
		this.data = forecasts;

		// test for some data available in at least one forecast
		const hasData = this.data.reduce((acc, forecast) => acc || forecast.high, false);
		if (!hasData) {
			this.setStatus(STATUS.noData);
			return;
		}

		this.setStatus(STATUS.loaded);
		this.drawLongCanvas();
	}

	async drawLongCanvas() {
		// create the "long" canvas if necessary
		if (!this.longCanvas) {
			this.longCanvas = document.createElement('canvas');
			this.longCanvas.width = 640;
			this.longCanvas.height = 1728;
			this.longContext = this.longCanvas.getContext('2d');
			this.longCanvasGifs = [];
		}

		// stop all gifs
		this.longCanvasGifs.forEach((gif) => gif.pause());
		// delete the gifs
		this.longCanvasGifs.length = 0;

		// set up variables
		const cities = this.data;

		// clean up existing gifs
		this.gifs.forEach((gif) => gif.pause());
		// delete the gifs
		this.gifs.length = 0;

		this.longContext.clearRect(0, 0, this.longCanvas.width, this.longCanvas.height);

		// draw the "long" canvas with all cities
		draw.box(this.longContext, 'rgb(35, 50, 112)', 0, 0, 640, TravelCities.length * this.cityHeight);

		for (let i = 0; i <= 4; i += 1) {
			const y = i * 346;
			draw.horizontalGradient(this.longContext, 0, y, 640, y + 346, '#102080', '#001040');
		}

		await Promise.all(cities.map(async (city, index) => {
			// calculate base y value
			const y = 50 + this.cityHeight * index;

			// city name
			draw.text(this.longContext, 'Star4000 Large Compressed', '24pt', '#FFFF00', 80, y, city.name, 2);

			// check for forecast data
			if (city.icon) {
				// get temperatures and convert if necessary
				let { low, high } = city;

				if (navigation.units() === UNITS.metric) {
					low = utils.units.fahrenheitToCelsius(low);
					high = utils.units.fahrenheitToCelsius(high);
				}

				// convert to strings with no decimal
				const lowString = Math.round(low).toString();
				const highString = Math.round(high).toString();

				const xLow = (500 - (lowString.length * 20));
				draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', xLow, y, lowString, 2);

				const xHigh = (560 - (highString.length * 20));
				draw.text(this.longContext, 'Star4000 Large', '24pt', '#FFFF00', xHigh, y, highString, 2);

				this.longCanvasGifs.push(await utils.image.superGifAsync({
					src: city.icon,
					auto_play: true,
					canvas: this.longCanvas,
					x: 330,
					y: y - 35,
					max_width: 47,
				}));
			} else {
				draw.text(this.longContext, 'Star4000 Small', '24pt', '#FFFFFF', 400, y - 18, 'NO TRAVEL', 2);
				draw.text(this.longContext, 'Star4000 Small', '24pt', '#FFFFFF', 400, y, 'DATA AVAILABLE', 2);
			}
		}));
	}

	async drawCanvas() {
		// there are technically 2 canvases: the standard canvas and the extra-long canvas that contains the complete
		// list of cities. The second canvas is copied into the standard canvas to create the scroll
		super.drawCanvas();

		// set up variables
		const cities = this.data;

		// draw the standard context
		this.context.drawImage(await this.backgroundImage, 0, 0);
		draw.horizontalGradientSingle(this.context, 0, 30, 500, 90, draw.topColor1, draw.topColor2);
		draw.triangle(this.context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		draw.titleText(this.context, 'Travel Forecast', `For ${TravelForecast.getTravelCitiesDayName(cities)}`);

		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 455, 105, 'LOW', 2);
		draw.text(this.context, 'Star4000 Small', '24pt', '#FFFF00', 510, 105, 'HIGH', 2);

		// copy the scrolled portion of the canvas for the initial run before the scrolling starts
		this.context.drawImage(this.longCanvas, 0, 0, 640, 289, 0, 110, 640, 289);

		this.finishDraw();
	}

	async showCanvas() {
		// special to travel forecast to draw the remainder of the canvas
		await this.drawCanvas();
		super.showCanvas();
	}

	// screen index change callback just runs the base count callback
	screenIndexChange() {
		this.baseCountChange(this.navBaseCount);
	}

	// base count change callback
	baseCountChange(count) {
		// get a fresh canvas
		const longCanvas = this.getLongCanvas();

		// calculate scroll offset and don't go past end
		let offsetY = Math.min(longCanvas.height - 289, (count - 150));

		// don't let offset go negative
		if (offsetY < 0) offsetY = 0;

		// copy the scrolled portion of the canvas
		this.context.drawImage(longCanvas, 0, offsetY, 640, 289, 0, 110, 640, 289);
	}

	static getTravelCitiesDayName(cities) {
		const { DateTime } = luxon;
		// effectively returns early on the first found date
		return cities.reduce((dayName, city) => {
			if (city && dayName === '') {
				// today or tomorrow
				const day = DateTime.local().plus({ days: (city.today) ? 0 : 1 });
				// return the day
				return day.toLocaleString({ weekday: 'long' });
			}
			return dayName;
		}, '');
	}

	// necessary to get the lastest long canvas when scrolling
	getLongCanvas() {
		return this.longCanvas;
	}
}
