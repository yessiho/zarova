import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

import { BillsService } from './bills.service.js';
import { PayBillDto, BillType } from './dto/pay-bill.dto.js';

interface JwtPayload {
  id: number;
  email: string;
  type: string;
}

/* Static catalogue returned by GET /bills/catalogue */
const BILL_CATALOGUE = {
  [BillType.AIRTIME]: {
    label:       'Airtime',
    description: 'Recharge any Nigerian mobile network instantly',
    icon:        'phone',
    providers: [
      { id: 'MTN',    name: 'MTN',    logo: 'mtn' },
      { id: 'AIRTEL', name: 'Airtel', logo: 'airtel' },
      { id: 'GLO',    name: 'Glo',    logo: 'glo' },
      { id: '9MOBILE',name: '9mobile',logo: '9mobile' },
    ],
    recipientLabel:       'Phone Number',
    recipientPlaceholder: '08012345678',
    recipientPattern:     '^0[789][01]\\d{8}$',
    quickAmounts:         [50, 100, 200, 500, 1000, 2000],
  },
  [BillType.DATA]: {
    label:       'Data',
    description: 'Buy internet data bundles for any network',
    icon:        'wifi',
    providers: [
      { id: 'MTN',    name: 'MTN Data',    logo: 'mtn' },
      { id: 'AIRTEL', name: 'Airtel Data', logo: 'airtel' },
      { id: 'GLO',    name: 'Glo Cafe',    logo: 'glo' },
      { id: '9MOBILE',name: '9mobile Data',logo: '9mobile' },
    ],
    recipientLabel:       'Phone Number',
    recipientPlaceholder: '08012345678',
    recipientPattern:     '^0[789][01]\\d{8}$',
    plans: {
      MTN:     [
        { id: 'MTN-500-1G',   label: '1GB – 1 Day',     amount: 300  },
        { id: 'MTN-1000-2G',  label: '2GB – 2 Days',    amount: 500  },
        { id: 'MTN-2000-5G',  label: '5GB – 30 Days',   amount: 2000 },
        { id: 'MTN-4000-10G', label: '10GB – 30 Days',  amount: 4000 },
        { id: 'MTN-8000-20G', label: '20GB – 30 Days',  amount: 8000 },
      ],
      AIRTEL:  [
        { id: 'AIR-500-1.5G', label: '1.5GB – 1 Day',   amount: 500  },
        { id: 'AIR-1000-3G',  label: '3GB – 3 Days',    amount: 1000 },
        { id: 'AIR-2000-6G',  label: '6GB – 30 Days',   amount: 2000 },
        { id: 'AIR-4000-12G', label: '12GB – 30 Days',  amount: 4000 },
      ],
      GLO:     [
        { id: 'GLO-500-1G',   label: '1GB – 1 Day',     amount: 500  },
        { id: 'GLO-1000-2G',  label: '2.5GB – 5 Days',  amount: 1000 },
        { id: 'GLO-2000-7G',  label: '7.5GB – 30 Days', amount: 2500 },
      ],
      '9MOBILE': [
        { id: '9M-500-1G',    label: '1GB – 1 Day',     amount: 500  },
        { id: '9M-1000-2G',   label: '2.5GB – 3 Days',  amount: 1000 },
        { id: '9M-2000-5G',   label: '5GB – 30 Days',   amount: 2000 },
      ],
    },
  },
  [BillType.ELECTRICITY]: {
    label:       'Electricity',
    description: 'Pay electricity bills and buy prepaid tokens',
    icon:        'zap',
    providers: [
      { id: 'EKEDC',  name: 'EKEDC (Eko)',     logo: 'ekedc'  },
      { id: 'IKEDC',  name: 'IKEDC (Ikeja)',   logo: 'ikedc'  },
      { id: 'AEDC',   name: 'AEDC (Abuja)',    logo: 'aedc'   },
      { id: 'PHED',   name: 'PHED (Port Harcourt)', logo: 'phed' },
      { id: 'KEDCO',  name: 'KEDCO (Kano)',    logo: 'kedco'  },
      { id: 'IBEDC',  name: 'IBEDC (Ibadan)',  logo: 'ibedc'  },
      { id: 'BEDC',   name: 'BEDC (Benin)',    logo: 'bedc'   },
      { id: 'JED',    name: 'JED (Jos)',        logo: 'jed'    },
    ],
    recipientLabel:       'Meter Number',
    recipientPlaceholder: '45012345678',
    recipientPattern:     '^\\d{11,13}$',
    quickAmounts:         [1000, 2000, 5000, 10000, 20000, 50000],
  },
  [BillType.CABLE_TV]: {
    label:       'Cable TV',
    description: 'Renew your DSTV, GOtv, or Startimes subscription',
    icon:        'tv',
    providers: [
      { id: 'DSTV',      name: 'DStv',      logo: 'dstv'      },
      { id: 'GOTV',      name: 'GOtv',      logo: 'gotv'      },
      { id: 'STARTIMES', name: 'Startimes', logo: 'startimes' },
      { id: 'MYTV',      name: 'MyTV Africa',logo: 'mytv'     },
    ],
    recipientLabel:       'Smart Card / IUC Number',
    recipientPlaceholder: '7012345678',
    recipientPattern:     '^\\d{7,12}$',
    plans: {
      DSTV: [
        { id: 'DSTV-PADI',    label: 'DStv Padi',        amount: 2150  },
        { id: 'DSTV-YANGA',   label: 'DStv Yanga',       amount: 2950  },
        { id: 'DSTV-CONFAM',  label: 'DStv Confam',      amount: 6200  },
        { id: 'DSTV-COMPACT', label: 'DStv Compact',     amount: 15700 },
        { id: 'DSTV-COMPLUS', label: 'DStv Compact+',    amount: 24700 },
        { id: 'DSTV-PREMIUM', label: 'DStv Premium',     amount: 37000 },
      ],
      GOTV: [
        { id: 'GOTV-SUPA',    label: 'GOtv Supa+',       amount: 6400  },
        { id: 'GOTV-MAX',     label: 'GOtv Max',         amount: 4850  },
        { id: 'GOTV-JOLLI',   label: 'GOtv Jolli',       amount: 3600  },
        { id: 'GOTV-JINJA',   label: 'GOtv Jinja',       amount: 2460  },
        { id: 'GOTV-LITE',    label: 'GOtv Lite',        amount: 900   },
      ],
      STARTIMES: [
        { id: 'ST-NOVA',      label: 'Nova',             amount: 1200  },
        { id: 'ST-BASIC',     label: 'Basic',            amount: 2100  },
        { id: 'ST-SMART',     label: 'Smart',            amount: 3800  },
        { id: 'ST-CLASSIC',   label: 'Classic',          amount: 5500  },
        { id: 'ST-SUPER',     label: 'Super',            amount: 6600  },
      ],
      MYTV: [
        { id: 'MYTV-BASIC',   label: 'Basic',            amount: 1500  },
        { id: 'MYTV-CLASSIC', label: 'Classic',          amount: 3000  },
        { id: 'MYTV-PREMIUM', label: 'Premium',          amount: 5000  },
      ],
    },
  },
  [BillType.INTERNET]: {
    label:       'Internet',
    description: 'Pay for home broadband & ISP subscriptions',
    icon:        'globe',
    providers: [
      { id: 'SPECTRANET', name: 'Spectranet', logo: 'spectranet' },
      { id: 'SMILE',      name: 'Smile',      logo: 'smile'      },
      { id: 'SWIFT',      name: 'Swift',      logo: 'swift'      },
      { id: 'IPNX',       name: 'ipNX',       logo: 'ipnx'       },
    ],
    recipientLabel:       'Account ID / Username',
    recipientPlaceholder: 'SN0012345678',
    recipientPattern:     '^[A-Za-z0-9\\-]{4,30}$',
    quickAmounts:         [3000, 5000, 10000, 15000, 20000],
  },
};

@ApiTags('Bills')
@ApiBearerAuth('access-token')
@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  /* ----------------------------------------------------------
     GET /bills/catalogue — static provider catalogue
     ---------------------------------------------------------- */
  @Get('catalogue')
  @ApiOperation({ summary: 'Get available bill types and providers' })
  @ApiResponse({ status: 200, description: 'Bill catalogue returned' })
  getCatalogue() {
    return BILL_CATALOGUE;
  }

  /* ----------------------------------------------------------
     POST /bills/pay — pay a bill
     ---------------------------------------------------------- */
  @Post('pay')
  @ApiOperation({ summary: 'Pay a bill (airtime, data, electricity, cable, internet)' })
  @ApiBody({ type: PayBillDto })
  @ApiResponse({ status: 201, description: 'Bill payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid input' })
  payBill(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PayBillDto,
  ) {
    return this.billsService.payBill(user.id, dto);
  }

  /* ----------------------------------------------------------
     GET /bills — user bill history
     ---------------------------------------------------------- */
  @Get()
  @ApiOperation({ summary: 'Get bill payment history' })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Bill history returned' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('limit',  new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0),  ParseIntPipe) offset: number,
  ) {
    return this.billsService.findAll(user.id, limit, offset);
  }

  /* ----------------------------------------------------------
     GET /bills/:id — single bill
     ---------------------------------------------------------- */
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bill payment by ID' })
  @ApiResponse({ status: 200, description: 'Bill payment returned' })
  @ApiResponse({ status: 404, description: 'Bill payment not found' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.billsService.findOne(user.id, id);
  }
}
