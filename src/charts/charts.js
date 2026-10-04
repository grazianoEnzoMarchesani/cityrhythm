// Unico punto che conosce la libreria dei grafici (oggi ECharts).
// ponytail: le opzioni dei grafici restano nel formato ECharts; per cambiare libreria vanno tradotte.
import * as echarts from 'echarts';

export const createChart = (element) => echarts.init(element);
