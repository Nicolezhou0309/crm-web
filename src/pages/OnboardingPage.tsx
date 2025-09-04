import React, { useState, useEffect, useCallback } from 'react';
import { Card, Steps, Button, message, Progress, Typography, Alert, Tag, Space, Radio, Checkbox, Input, Collapse } from 'antd';
import { 
  BookOutlined, 
  FileTextOutlined, 
  TeamOutlined, 
  CheckCircleOutlined,
  QuestionCircleOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { supabase } from '../supaClient';
import { getCurrentProfileId } from '../api/pointsApi';
import { toBeijingTime } from '../utils/timeUtils';




const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface Question {
  id: string;
  module: string;
  moduleTitle: string;
  type: 'single' | 'multiple' | 'fill' | 'essay';
  title: string;
  options?: string[];
  answer: string | string[];
  keywords: string;
  explanation: string;
}

interface ExamStatus {
  status: 'pending' | 'studying' | 'exam_passed' | 'completed' | 'formal_exam';
  answeredQuestions: string[];
  examAttempts: number;
  progressPercentage: number;
  assignedSalesGroupId?: number;
  formalExamQuestions?: string[];
  formalExamScore?: number;
  formalExamAttempts?: number;
  formalExamStartTime?: number;
  formalExamTimeLimit?: number; // 15分钟 = 900秒
}

const OnboardingPage: React.FC = () => {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [formalExamMode, setFormalExamMode] = useState(false);
  const [formalExamQuestions, setFormalExamQuestions] = useState<Question[]>([]);
  const [formalExamScore, setFormalExamScore] = useState(0);
  const [formalExamTimeLeft, setFormalExamTimeLeft] = useState(900); // 15分钟倒计时
  const [examTimer, setExamTimer] = useState<NodeJS.Timeout | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);
  const [salesGroupInfo, setSalesGroupInfo] = useState<any>(null);

  // 考试题目数据
  const examQuestions: Question[] = [
    // Module 1: 新人期基础
    {
      id: '1-1',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '新人期针对入职多少天内的新人？',
      options: ['15', '30', '45', '60'],
      answer: 'B',
      keywords: '30天',
      explanation: '新人期是公司针对新入职员工的特殊培训阶段，目的是帮助新人快速上手。根据政策，新人期覆盖入职后的30天内，之后将进入常规考核。选项B正确。'
    },
    {
      id: '1-2',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '新人期完成任务可获得什么奖励？',
      options: ['现金', '积分', '奖品', '荣誉证书'],
      answer: 'B',
      keywords: '积分奖励',
      explanation: '在新人期内，完成任务的主要激励是积分奖励，而非现金或其他形式。积分可用于兑换线索等资源，帮助新人积累初始资源。选项B正确。'
    },
    {
      id: '1-3',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'multiple',
      title: '新人期获得积分的前置条件包括哪些？',
      options: ['政策考试通过', '销讲通过', '微聊答题通过', '完成视频模拟直播考核'],
      answer: ['A', 'B', 'C'],
      keywords: '政策考试、销讲、微聊答题',
      explanation: '新人获得积分前必须满足三个前置条件：通过政策考试（确保了解公司规则）、通过销讲（销售演讲能力考核）、以及通过微聊答题（在线沟通技能测试）。选项D是额外任务，非前置条件，因此正确答案是A、B、C。'
    },
    {
      id: '1-4',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '新人期的新媒体积分加分和绩效提报方式是？',
      options: ['每周提报链接', '联系片区市场运营', '新媒体沟通群内提报', '以上都不是'],
      answer: 'A',
      keywords: '每周链接',
      explanation: '新人期任务提报需通过公司提供的每周专用链接进行，这确保数据统一管理和跟踪。其他选项如联系运营或在群内提报，仅作为补充方式，非主要途径。选项A正确。'
    },
    {
      id: '1-5',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'multiple',
      title: '小红书提报加分的要求是？',
      options: ['完成3个账号的发帖', '内容符合获客要求', '核查时内容不违规', '一个账号发满5条帖子'],
      answer: ['A', 'B', 'C'],
      keywords: '3个账号发帖、内容符合要求、内容不违规',
      explanation: '小红书提报加分需要同时满足多个要求：A（完成3个账号的发帖是基础要求）、B（内容必须符合获客要求）、C（核查时内容不能违规）。选项D错误，因为要求是3个账号而不是一个账号发满5条。正确答案是A、B、C。'
    },
    {
      id: '1-6',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'multiple',
      title: '短视频提报加分的要求是？',
      options: ['定位在重点商圈', '定位在社区附近', '文案包含价格', '文案包含社区的加法优势'],
      answer: ['A', 'C', 'D'],
      keywords: '重点商圈定位、价格信息、社区优势',
      explanation: '短视频提报加分要求：A（定位在重点商圈，提高曝光度）、C（文案包含价格，提供明确信息）、D（文案包含社区的加法优势，突出卖点）。选项B错误，定位在社区附近是没有流量的。正确答案是A、C、D。'
    },
    {
      id: '1-7',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'multiple',
      title: '在小红书平台获客的关键是？',
      options: ['打造真实人设，获得用户信任', '多个账号持续发帖', '明亮整洁的房间照片和有吸引力的文案', '内容注意不要涉及违规词'],
      answer: ['A', 'B', 'C', 'D'],
      keywords: '真实人设、持续发帖、优质内容、合规要求',
      explanation: '小红书平台获客需要全面策略：A（打造真实人设，建立信任关系）、B（多个账号持续发帖，扩大曝光）、C（明亮整洁的房间照片和有吸引力的文案，提升吸引力）、D（内容注意不要涉及违规词，确保合规）。所有选项都是获客的关键要素。正确答案是A、B、C、D。'
    },
    {
      id: '1-8',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'multiple',
      title: '在抖音渠道获客的关键是？',
      options: ['持续更新，建立账号人设', '每周发1条视频', '直播+短视频同时获客', '每天发布同样的视频'],
      answer: ['A', 'C'],
      keywords: '持续更新、人设建设、直播短视频结合',
      explanation: '抖音渠道获客关键要素：A（持续更新，建立账号人设，提高用户粘性）、C（直播+短视频同时获客，多渠道引流）。选项B错误，每周1条视频频率太低；选项D错误，重复内容不利于账号发展。正确答案是A、C。'
    },
    {
      id: '1-9',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '在发放线索过程中，系统会如何处理7天内的重复客户？',
      options: ['分配给新的销售人员', '优先分配给原销售人员', '随机分配给任何销售人员', '暂停分配等待处理'],
      answer: 'B',
      keywords: '优先分配给原销售',
      explanation: '系统会自动检测7天内相同手机号或微信号的重复客户，优先分配给原销售人员，确保客户关系的连续性和服务质量。选项B正确。'
    },
    {
      id: '1-10',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '加入销售组后，线索多久会发放？',
      options: ['立即发放', '1天内发放', '3天内发放', '一周内发放'],
      answer: 'C',
      keywords: '3天内发放',
      explanation: '线索发放根据市场客户量情况，只要线索状态保持正常（跟进状态正常、有积分、转化率合格），一般3天内会发放到销售人员。选项C正确。'
    },
    {
      id: '1-11',
      module: '1',
      moduleTitle: '新人期基础',
      type: 'single',
      title: '添加官网客户后，应该如何追踪客户跟进和成交情况？',
      options: ['无需备注，系统自动追踪', '添加微信时必须为客户备注线索编号', '只在成交时备注编号', '随意备注即可'],
      answer: 'B',
      keywords: '备注线索编号',
      explanation: '添加官网客户后，添加微信时必须为客户备注线索编号。线索ID采用"年份+月份+序号"格式，例如25J00005表示2025年1月第5个线索，便于识别和管理。同时如果盘客时发现未更新，会扣除积分。选项B正确。'
    },

    // Module 2: 积分系统
    {
      id: '2-1',
      module: '2',
      moduleTitle: '积分系统',
      type: 'multiple',
      title: '获得积分的途径包括哪些？',
      options: ['直播积分', '业绩激励', '新人期积分', '以上都不是'],
      answer: ['A', 'B', 'C'],
      keywords: '直播、业绩、新人期',
      explanation: '积分可通过三种主要途径获取：参与直播活动（如勤奋度任务）、完成业绩目标（如签约激励）、以及新人期任务奖励。选项D错误，因为A、B、C都是有效途径。'
    },
    {
      id: '2-2',
      module: '2',
      moduleTitle: '积分系统',
      type: 'multiple',
      title: '直播的参与前需要完成什么？',
      options: ['每周在链接内报名', '联系片区市场运营', '新媒体沟通群内提报', '以上都不是'],
      answer: ['A', 'B'],
      keywords: '每周在链接内报名、联系片区市场运营',
      explanation: '参与直播活动需先联系片区市场运营人员完成报名任务，任务完成后每周做链接内报名。选项A和C是其他任务的提报方式，不适用于直播。选项B正确。'
    },
    {
      id: '2-3',
      module: '2',
      moduleTitle: '积分系统',
      type: 'single',
      title: '每周完成勤奋度任务，新手期最多可以获得多少积分？',
      options: ['1200', '1400', '1600', '1800'],
      answer: 'D',
      keywords: '1800积分',
      explanation: '每周勤奋度任务包括小红书（300积分）和短视频（150积分），合计450积分/周。按月计算（4周），最多可获得1800积分，并可兑换约60条线索。选项D正确。'
    },
    {
      id: '2-4',
      module: '2',
      moduleTitle: '积分系统',
      type: 'multiple',
      title: '积分在工作中有什么作用？',
      options: ['换奶茶', '换带看', '换线索', '换钱'],
      answer: ['B', 'C'],
      keywords: '兑换线索/带看',
      explanation: '积分主要用于业务资源兑换，如换取带看机会或销售线索，直接支持业绩提升。选项A和D是错误干扰项，积分不能兑换非业务物品或现金。正确答案是B和C。'
    },
    {
      id: '2-5',
      module: '2',
      moduleTitle: '积分系统',
      type: 'single',
      title: '如果连续3天都是【线索未接受状态】，每天扣多少积分？',
      options: ['500', '600', '700', '800'],
      answer: 'B',
      keywords: '600积分',
      explanation: '根据积分管理规则，线索状态未及时更新（如连续3天"未接受"）会被视为低效，每天扣600积分，以督促及时跟进。选项B正确。'
    },

    // Module 3: SOP执行与扣分规则
    {
      id: '3-1',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: '盘客时，未通过线索不进行电话联系（48小时内）扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: '盘客环节中，未在48小时内对未通过线索进行电话联系，视为跟进延迟，扣100积分。这确保销售动作及时性。选项B正确。'
    },
    {
      id: '3-2',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: '盘客时，无效线索未及时反馈（24小时）扣多少积分？',
      options: ['30', '50', '80', '100'],
      answer: 'B',
      keywords: '50积分',
      explanation: '无效线索需在24小时内反馈至系统，否则扣50积分。这避免资源浪费，并保持数据准确性。选项B正确。'
    },
    {
      id: '3-3',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: '盘客时，线索未添加扣多少积分？',
      options: ['200', '300', '400', '500'],
      answer: 'B',
      keywords: '300积分',
      explanation: '线索未添加至跟进系统，表示基础操作缺失，扣300积分。这强调数据录入的重要性。选项B正确。'
    },
    {
      id: '3-4',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，未询问客户需求（入住时间/工作地点/预算）扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: 'SOP要求必须询问客户关键需求（入住时间、工作地点、预算），未执行扣100积分，以确保需求匹配和转化率。选项B正确。'
    },
    {
      id: '3-5',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，客户未备注线索编号扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: '线索编号备注是跟踪客户的基础，未备注扣100积分，防止数据混乱。选项B正确。'
    },
    {
      id: '3-6',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，不进行洗客环节（1小时内通勤，1000元预算差距）扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: '洗客环节（筛选符合通勤和预算的客户）是SOP核心，未执行扣100积分，以优化资源分配。选项B正确。'
    },
    {
      id: '3-7',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，外社区意向客户不推荐扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: '外社区客户推荐是交叉销售机会，不推荐扣100积分，鼓励团队协作。选项B正确。'
    },
    {
      id: '3-8',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，5天内未进行回访动作扣多少积分？',
      options: ['50', '100', '150', '200'],
      answer: 'B',
      keywords: '100积分',
      explanation: '回访是维护客户关系的关键，5天内未执行扣100积分，确保跟进连续性。选项B正确。'
    },
    {
      id: '3-9',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，工作日9~21点消息不回复超过2小时扣多少积分？',
      options: ['200', '300', '400', '500'],
      answer: 'B',
      keywords: '300积分',
      explanation: '及时回复消息（工作时段内超2小时未回复）影响客户体验，扣300积分，强调响应速度。选项B正确。'
    },
    {
      id: '3-10',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，主动删除客户扣多少积分？',
      options: ['500', '600', '700', '800'],
      answer: 'B',
      keywords: '600积分',
      explanation: '主动删除客户视为资源浪费，扣600积分，以保留潜在销售机会。选项B正确。'
    },
    {
      id: '3-11',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'single',
      title: 'SOP执行中，态度恶劣（辱骂客户/客诉反馈）会如何处理？',
      options: ['扣1000积分', '积分清零', '扣500积分', '扣200积分'],
      answer: 'B',
      keywords: '积分清零',
      explanation: '态度恶劣（如辱骂或客诉）是严重违规，直接导致积分清零，维护公司形象。选项B正确。'
    },
    {
      id: '3-12',
      module: '3',
      moduleTitle: 'SOP执行与扣分规则',
      type: 'multiple',
      title: 'SOP执行中，哪些行为会导致扣积分？',
      options: ['未询问客户需求', '客户未备注线索编号', '不进行洗客环节', '外社区意向客户不推荐', '5天内未进行回访动作'],
      answer: ['A', 'B', 'C', 'D', 'E'],
      keywords: '多种扣分行为',
      explanation: 'SOP执行中，所有选项行为都会导致扣分：A（扣100分）、B（扣100分）、C（扣100分）、D（扣100分）、E（扣100分）。这强调全面遵守流程。'
    },

    // Module 4: 线索管理
    {
      id: '4-1',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '跟进表中，可根据个人需要进行哪些操作？',
      options: ['筛选', '排序', '分组', '以上都是'],
      answer: 'D',
      keywords: '筛选、排序、分组',
      explanation: '跟进表支持筛选（按条件过滤数据）、排序（按字段排列）和分组（分类管理），方便个性化数据操作。选项D正确。'
    },
    {
      id: '4-2',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '丢单流程适用于哪种客户？',
      options: ['已签约客户', '无效客户', '潜在客户', '以上都不是'],
      answer: 'B',
      keywords: '无效客户',
      explanation: '终止流程用于标记无效客户（即无法成交的客户），以便释放资源。其他选项不适用。选项B正确。'
    },
    {
      id: '4-3',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '成交上传是在哪个阶段填写社区/房间号/合同号？',
      options: ['已到店阶段', '跟进中阶段', '潜在客户阶段', '以上都不是'],
      answer: 'A',
      keywords: '已到店阶段',
      explanation: '成交数据（如社区、房间号、合同号）必须在已到店阶段上传，确保信息及时回传系统。选项A正确。'
    },
    {
      id: '4-4',
      module: '4',
      moduleTitle: '线索管理',
      type: 'multiple',
      title: '有哪些情况会导致积分线索无法发放？',
      options: ['转化率过低', '未完成跟进', '积分余额不足', '当日线索达到上限'],
      answer: ['A', 'B', 'C', 'D'],
      keywords: '多种原因',
      explanation: '所有选项都会导致线索停发：A（转化率低表示效率问题）、B（跟进不全影响数据质量）、C（积分不足无法兑换）、D（达到每日上限）。'
    },
    {
      id: '4-5',
      module: '4',
      moduleTitle: '线索管理',
      type: 'multiple',
      title: '关于成交客户上传，以下说法正确的是：',
      options: ['成交后需在线索表内完成已签约阶段', '预定或者成交都应上传', '成交2小时内需要上传结果', '有空了再上传'],
      answer: ['A', 'B', 'C'],
      keywords: '及时上传',
      explanation: '成交上传要求：A（必须完成已签约阶段填写）、B（预定和成交都需上传）、C（2小时内及时上传确保数据新鲜）。选项D错误，上传不可延迟。'
    },
    {
      id: '4-6',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '以下哪种情况可回退线索？',
      options: ['在住客户', '不符合入住条件', '线索重复', '手机空号或停机/微信不存在', '以上都是'],
      answer: 'E',
      keywords: '多种回退理由',
      explanation: '回退线索适用于所有情况：A（在住客户无需跟进）、B（条件不符）、C（重复数据）、D（无效联系方式）。选项E正确。'
    },
    {
      id: '4-7',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '线索回退的操作步骤有哪些？',
      options: ['在线索跟进表自助回退', '联系市场运营退线索', '联系客户反馈无效线索', '在跟进表操作丢单'],
      answer: 'A',
      keywords: '在线索跟进表自助回退',
      explanation: '回退操作只有一种方式：A（直接点击界面回退按钮）。上传回退证据后，会有人专人负责审批。选项B、C和D错误。'
    },
    {
      id: '4-8',
      module: '4',
      moduleTitle: '线索管理',
      type: 'single',
      title: '线索接收阶段，最多发送多少个新线索？',
      options: ['2', '3', '4', '5'],
      answer: 'A',
      keywords: '2个',
      explanation: '线索接收阶段，系统每次最多发送2个新线索。需在通知内确认接收后，才能继续发送，避免信息过载。选项A正确。'
    },

    // Module 5: 综合应用
    {
      id: '5-1',
      module: '5',
      moduleTitle: '综合应用',
      type: 'fill',
      title: '大于100个线索时，转化率低于______%会导致线索停发',
      answer: '3',
      keywords: '3%',
      explanation: '当线索量超过100条时，如果转化率（成交率）低于3%，系统会自动停发新线索。这鼓励优化跟进效率，避免资源浪费。'
    },
    {
      id: '5-2',
      module: '5',
      moduleTitle: '综合应用',
      type: 'single',
      title: '在销售过程中，转化率最重要的作用是什么？',
      options: ['直接制定公寓的市场定价', '衡量跟进效果并识别销售漏斗中的瓶颈', '了解市场人群变化', '优化组织架构'],
      answer: 'B',
      keywords: '衡量跟进效果、识别瓶颈',
      explanation: '转化率是销售过程中的核心指标，最重要的作用是衡量跟进效果并识别销售漏斗中的瓶颈。通过分析转化率，可以了解在哪个环节客户流失最多，从而针对性地优化销售流程，提高整体效率。选项A、C、D虽然也是重要指标，但不如转化率更能直接反映销售效果和问题所在。选项B正确。'
    },
    {
      id: '5-3',
      module: '5',
      moduleTitle: '综合应用',
      type: 'essay',
      title: '跟进中，如何提高成交率？',
      answer: '提高成交率需要：及时回复客户消息（工作时段内响应）、按时进行回访和预约看房、提供优质的客户服务（如解决疑问）、深入了解客户需求（入住时间、预算等）并针对性地解决问题、建立良好的客户关系（如定期跟进）。关键是通过SOP执行减少失误，并利用积分系统兑换高质量线索。',
      keywords: '及时回复、回访、了解需求',
      explanation: '成交率是销售核心指标，提升方法包括：快速响应（避免超时扣分）、主动回访（5天内动作）、需求分析（如未询问需求会扣分），以及关系维护。新人应结合积分规则（如兑换线索）和SOP避免扣分，以数据驱动决策。'
    },
    {
      id: '5-4',
      module: '5',
      moduleTitle: '综合应用',
      type: 'essay',
      title: '积分扣减规则中，如何避免扣分？',
      answer: '避免扣分需要：及时跟进线索（48小时内电话联系）、快速反馈无效线索（24小时内）、正确添加线索到系统、询问客户关键需求（入住时间、工作地点、预算）、备注线索编号、执行洗客环节、推荐外社区客户、定期回访（5天内）、及时回复消息（工作时段内2小时内）、不主动删除客户、保持良好的服务态度。关键是要严格按照SOP执行，避免违规操作。',
      keywords: '及时跟进、SOP执行、良好态度',
      explanation: '积分扣减规则严格，避免扣分需要全面遵守SOP流程：及时性（48小时电话、24小时反馈、2小时回复）、完整性（添加线索、备注编号、询问需求）、规范性（洗客、推荐、回访）、态度性（不删除客户、不辱骂客户）。只有全面执行才能避免扣分。'
    }
  ];

  // 获取用户考试状态（从localStorage）
  const getUserStatus = (): ExamStatus => {
    const stored = localStorage.getItem('onboarding_exam_status');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      status: 'pending',
      answeredQuestions: [],
      examAttempts: 0,
      progressPercentage: 0
    };
  };

  // 保存用户状态
  const saveUserStatus = (status: ExamStatus) => {
    localStorage.setItem('onboarding_exam_status', JSON.stringify(status));
    setStatus(status);
  };

  // 标记题目已答
  const markQuestionAnswered = (questionId: string) => {
    const currentStatus = getUserStatus();
    
    if (formalExamMode) {
      // 正式考试模式：不更新模拟考试的缓存
      return;
    }
    
    if (!currentStatus.answeredQuestions.includes(questionId)) {
      const newAnsweredQuestions = [...currentStatus.answeredQuestions, questionId];
      const progressPercentage = Math.round((newAnsweredQuestions.length / questions.length) * 100);
      
      const newStatus: ExamStatus = {
        ...currentStatus,
        status: 'studying' as const,
        answeredQuestions: newAnsweredQuestions,
        progressPercentage
      };
      
      saveUserStatus(newStatus);
    }
  };

  // 检查答案是否正确
  const checkAnswer = (question: Question, userAnswer: any): boolean => {
    if (question.type === 'single') {
      return userAnswer === question.answer;
    } else if (question.type === 'multiple') {
      const correctAnswers = Array.isArray(question.answer) ? question.answer : [question.answer];
      const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      return correctAnswers.length === userAnswers.length && 
             correctAnswers.every(ans => userAnswers.includes(ans));
    } else if (question.type === 'fill') {
      return userAnswer?.toString().toLowerCase().trim() === question.answer.toString().toLowerCase().trim();
    } else if (question.type === 'essay') {
      // 问答题不进行自动判断，只显示参考答案
      return true;
    }
    return false;
  };

  // 提交答案
  const submitAnswer = (questionId: string) => {
    const question = formalExamMode ? formalExamQuestions.find(q => q.id === questionId) : questions.find(q => q.id === questionId);
    
    if (!question) return;
    
    
    markQuestionAnswered(questionId);
    setSubmittedQuestions(prev => new Set([...prev, questionId]));
    
    // 正式考试模式下保存答案到本地存储
    if (formalExamMode) {
      localStorage.setItem('formal_exam_answers', JSON.stringify(userAnswers));
    }
    
    // 模拟考试模式下提交答案后立即显示答案
    if (!formalExamMode) {
      setShowAnswers(true);
    }
    
    // 显示正确或错误的反馈
    if (question.type === 'essay') {
      // 移除问答题提交提示
    }
  };

  // 提交答案并切换到下一题（正式考试模式）
  const submitAndNext = (questionId: string) => {
    if (!formalExamMode) return;
    
    // 提交答案
    submitAnswer(questionId);
    
    // 延迟切换到下一题
    setTimeout(() => {
      const currentQuestions = formalExamQuestions;
      const currentIndex = currentQuestionIndex;
      
      if (currentIndex < currentQuestions.length - 1) {
        setCurrentQuestionIndex(currentIndex + 1);
      }
    }, 500); // 500ms后切换到下一题
  };

  // 获取答题状态

  // 获取模块题目

  // 获取模块进度

  // 渲染题目
  const renderQuestion = (question: Question) => {
    const isSubmitted = submittedQuestions.has(question.id);
    const userAnswer = userAnswers[question.id];
    const currentQuestions = formalExamMode ? formalExamQuestions : questions;
    const currentIndex = currentQuestionIndex;

    return (
      <Card 
        style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
        title={
                      <div style={{ wordBreak: 'break-word', lineHeight: '1.4', whiteSpace: 'normal', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, flex: 1, textAlign: 'left' }}>{question.title}</span>
              </div>
            </div>
        }
        extra={
          <Space style={{ marginRight: '-4px' }}>
            <Tag color="blue">{question.type === 'single' ? '单选题' : 
                               question.type === 'multiple' ? '多选题' : 
                               question.type === 'fill' ? '填空题' : '问答题'}</Tag>
          </Space>
        }
      >
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'auto',
          paddingBottom: '100px' // 为底部按钮留出空间
        }}>
          {question.type === 'single' && (
            <Radio.Group 
              value={userAnswer} 
              onChange={(e) => {
                setUserAnswers({...userAnswers, [question.id]: e.target.value});
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => (
                  <Radio 
                    key={index} 
                    value={String.fromCharCode(65 + index)}
                    style={{ 
                      padding: '8px 12px', 
                      border: isSubmitted && userAnswer === String.fromCharCode(65 + index) && !checkAnswer(question, userAnswer) 
                        ? '1px solid #ff4d4f' 
                        : '1px solid #f0f0f0', 
                      borderRadius: '6px',
                      marginBottom: '6px',
                      width: '100%',
                      fontSize: '13px',
                      backgroundColor: isSubmitted && userAnswer === String.fromCharCode(65 + index) && !checkAnswer(question, userAnswer) 
                        ? '#fff2f0' 
                        : 'transparent'
                    }}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}

          {question.type === 'multiple' && (
            <Checkbox.Group 
              value={userAnswer || []} 
              onChange={(checkedValues) => {
                setUserAnswers({...userAnswers, [question.id]: checkedValues});
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => (
                  <Checkbox 
                    key={index} 
                    value={String.fromCharCode(65 + index)}
                    style={{ 
                      padding: '8px 12px', 
                      border: isSubmitted && userAnswer && userAnswer.includes(String.fromCharCode(65 + index)) && !checkAnswer(question, userAnswer) 
                        ? '1px solid #ff4d4f' 
                        : '1px solid #f0f0f0', 
                      borderRadius: '6px',
                      marginBottom: '6px',
                      width: '100%',
                      fontSize: '13px',
                      backgroundColor: isSubmitted && userAnswer && userAnswer.includes(String.fromCharCode(65 + index)) && !checkAnswer(question, userAnswer) 
                        ? '#fff2f0' 
                        : 'transparent'
                    }}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          )}

          {question.type === 'fill' && (
            <Input 
              placeholder="请输入答案"
              value={userAnswer || ''} 
              onChange={(e) => {
                setUserAnswers({...userAnswers, [question.id]: e.target.value});
              }}
              onPressEnter={() => {
                if (formalExamMode && userAnswer && userAnswer.toString().trim()) {
                  submitAndNext(question.id);
                }
              }}
              size="middle"
              style={{ 
                fontSize: '13px',
                borderColor: isSubmitted && userAnswer && !checkAnswer(question, userAnswer) ? '#ff4d4f' : undefined,
                backgroundColor: isSubmitted && userAnswer && !checkAnswer(question, userAnswer) ? '#fff2f0' : undefined
              }}
            />
          )}

          {question.type === 'essay' && (
            <TextArea 
              rows={4}
              placeholder="请输入您的答案"
              value={userAnswer || ''} 
              onChange={(e) => {
                setUserAnswers({...userAnswers, [question.id]: e.target.value});
              }}
              onPressEnter={() => {
                if (formalExamMode && userAnswer && userAnswer.toString().trim()) {
                  submitAndNext(question.id);
                }
              }}
              style={{ 
                fontSize: '13px',
                borderColor: isSubmitted && userAnswer && !checkAnswer(question, userAnswer) ? '#ff4d4f' : undefined,
                backgroundColor: isSubmitted && userAnswer && !checkAnswer(question, userAnswer) ? '#fff2f0' : undefined
              }}
            />
          )}
        </div>

        {/* 固定在底部的按钮组 */}
        <div style={{ 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px'
        }}>
                      {!formalExamMode && (
                        <Button 
                          type="primary" 
                          size="middle"
                          disabled={!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)}
                          onClick={() => submitAnswer(question.id)}
                          style={{ width: '100%', fontSize: '13px', borderRadius: '6px' }}
                        >
                          {isSubmitted ? '已提交' : '提交答案'}
                        </Button>
                      )}
                      
                      {formalExamMode && (
                        <Button 
                          type="primary" 
                          size="middle"
                          disabled={!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)}
                          onClick={() => submitAndNext(question.id)}
                          style={{ width: '100%', fontSize: '13px', borderRadius: '6px' }}
                        >
                          {isSubmitted ? '已提交' : '提交答案并下一题'}
                        </Button>
                      )}
          
          {/* 题目导航 */}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Button 
                size="small"
                disabled={currentIndex === 0}
                onClick={() => {
                  if (formalExamMode) {
                    // 正式考试模式下，直接使用 formalExamQuestions 的索引
                    const prevIndex = Math.max(0, currentIndex - 1);
                    setCurrentQuestionIndex(prevIndex);
                  } else {
                    setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
                  }
                }}
                icon={<LeftOutlined />}
                style={{ fontSize: '12px', borderRadius: '4px' }}
              >
                上一题
              </Button>
              <span style={{ fontSize: '12px', color: '#666' }}>
                第 {currentIndex + 1} 题 / 共 {currentQuestions.length} 题
              </span>
              <Button 
                size="small"
                disabled={currentIndex === currentQuestions.length - 1}
                onClick={() => {
                  if (formalExamMode) {
                    // 正式考试模式下，直接使用 formalExamQuestions 的索引
                    const nextIndex = Math.min(formalExamQuestions.length - 1, currentIndex + 1);
                    setCurrentQuestionIndex(nextIndex);
                  } else {
                    setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1));
                  }
                }}
                icon={<RightOutlined />}
                style={{ fontSize: '12px', borderRadius: '4px' }}
              >
                下一题
              </Button>
          </div>
        </div>
      </Card>
    );
  };

  // 渲染答案解析
  const renderAnswerExplanation = (question: Question) => {
    const isSubmitted = submittedQuestions.has(question.id);
    const userAnswer = userAnswers[question.id];
    
    // 正式考试模式下不显示答案解析
    if (formalExamMode) {
      return (
        <Card 
          style={{ height: '100%' }}
          title={
            <div style={{ wordBreak: 'break-word', lineHeight: '1.4', whiteSpace: 'normal', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>正式考试模式</span>
              </div>
            </div>
          }
          bodyStyle={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '24px',
            height: 'calc(100% - 57px)'
          }}
        >
          <div style={{ textAlign: 'center', color: '#999' }}>
            <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <Title level={4}>正式考试进行中</Title>
            <Paragraph>考试完成后将显示成绩</Paragraph>
          </div>
        </Card>
      );
    }
    
    // 模拟考试模式下，只有提交当前题目答案后才显示答案
    if (!isSubmitted || !showAnswers) {
      return (
        <Card 
          style={{ height: '100%' }}
          title={
            <div style={{ wordBreak: 'break-word', lineHeight: '1.4', whiteSpace: 'normal', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>答案与解析</span>
              </div>
            </div>
          }
          bodyStyle={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '24px',
            height: 'calc(100% - 57px)'
          }}
        >
          <div style={{ textAlign: 'center', color: '#999' }}>
            <QuestionCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <Title level={4}>请先提交答案</Title>
            <Paragraph>提交答案后将显示正确答案和解析</Paragraph>
          </div>
        </Card>
      );
    }

    const isCorrect = checkAnswer(question, userAnswer);
    const userAnswerDisplay = Array.isArray(userAnswer) ? userAnswer.join('、') : userAnswer;

    return (
      <Card 
        style={{ height: '100%' }}
        title={
          <div style={{ wordBreak: 'break-word', lineHeight: '1.4', whiteSpace: 'normal', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>答案与解析</span>
              {isCorrect ? (
                <Tag color="success">正确</Tag>
              ) : (
                <Tag color="error">错误</Tag>
              )}
            </div>
          </div>
        }
      >
        <div style={{ 
          height: '100%', 
          overflow: 'auto',
          padding: '16px',
          fontSize: '13px'
        }}>
          {question.type !== 'essay' && (
            <Paragraph>
              <Text strong>您的答案：</Text>
              <Text style={{ color: isCorrect ? '#52c41a' : '#ff4d4f' }}>
                {userAnswerDisplay || '未作答'}
              </Text>
            </Paragraph>
          )}
          <Paragraph>
            <Text strong>正确答案：</Text>
            {Array.isArray(question.answer) ? question.answer.join('、') : question.answer}
          </Paragraph>
          <Paragraph>
            <Text strong>关键字：</Text>
            <Text code>{question.keywords}</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>解析：</Text>
            {question.explanation}
          </Paragraph>
        </div>
      </Card>
    );
  };

  // 检查用户是否已加入销售组
  const checkUserSalesGroup = async () => {
    try {
      const profileId = await getCurrentProfileId();
      if (!profileId) {
        return false;
      }
      
      
      const { data, error } = await supabase.rpc('get_user_allocation_status_multi', {
        p_user_id: profileId,
      });
      
      if (error) {
        console.error('获取用户销售组状态失败:', error);
        return false;
      }
      
      
      // 如果返回的数据是数组且有内容，说明用户已加入销售组
      if (Array.isArray(data) && data.length > 0) {
        // 保存销售组信息
        setSalesGroupInfo(data[0]);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('检查用户销售组状态失败:', error);
      return false;
    }
  };

  // 初始化
  useEffect(() => {
    const initializePage = async () => {
      setQuestions(examQuestions);
      const userStatus = getUserStatus();
      setStatus(userStatus);
      
      // 检查是否已经加入销售组，如果是则直接跳转到步骤3
      const hasSalesGroup = await checkUserSalesGroup();
      if (hasSalesGroup) {
        setCurrentStep(2); // 步骤3（索引为2）
        setLoading(false);
        return;
      }
      
      // 恢复正式考试状态
      if (userStatus.status === 'formal_exam' && userStatus.formalExamStartTime) {
        const elapsedTime = Math.floor((toBeijingTime(new Date()).valueOf() - userStatus.formalExamStartTime) / 1000);
        const remainingTime = Math.max(0, 900 - elapsedTime); // 15分钟 = 900秒
        
        if (remainingTime > 0) {
          setFormalExamMode(true);
          setFormalExamTimeLeft(remainingTime);
          setFormalExamQuestions(examQuestions.filter(q => userStatus.formalExamQuestions?.includes(q.id)));
          setCurrentQuestionIndex(0);
          
          // 恢复正式考试的用户答案
          const savedAnswers = localStorage.getItem('formal_exam_answers');
          if (savedAnswers) {
            setUserAnswers(JSON.parse(savedAnswers));
          }
          
          // 恢复正式考试的答题状态
          if (userStatus.formalExamQuestions) {
            setSubmittedQuestions(new Set(userStatus.formalExamQuestions));
          }
        } else {
          // 时间已到，自动提交考试
          message.error('考试时间已到，系统自动提交！');
          finishFormalExam().catch(error => {
            console.error('初始化时自动提交考试失败:', error);
          });
        }
      } else {
        // 非正式考试模式，恢复模拟考试进度
        if (userStatus.answeredQuestions.length > 0) {
          setSubmittedQuestions(new Set(userStatus.answeredQuestions));
        }
      }
      
      // 无论什么情况，默认都隐藏答案
      setShowAnswers(false);
      
      setLoading(false);
    };
    
    initializePage();
  }, []);

  // 开始正式考试
  const startFormalExam = () => {
    // 随机抽取20道题目（从40道题目中抽取）
    const shuffled = [...examQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, 20);
    
    setFormalExamQuestions(selectedQuestions);
    setFormalExamMode(true);
    setCurrentQuestionIndex(0);
    // 正式考试使用独立的答题状态，不继承模拟考试的缓存
    setSubmittedQuestions(new Set());
    setUserAnswers({});
    setShowAnswers(false); // 正式考试不显示答案
    setFormalExamTimeLeft(900); // 15分钟倒计时
    
    // 启动计时器
    const timer = setInterval(() => {
      setFormalExamTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          message.error('考试时间已到，系统自动提交！');
          finishFormalExam().catch(error => {
            console.error('自动提交考试失败:', error);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setExamTimer(timer);
    
    // 更新状态
    const newStatus: ExamStatus = {
      ...status!,
      status: 'formal_exam' as const,
      formalExamQuestions: selectedQuestions.map(q => q.id),
      formalExamAttempts: (status?.formalExamAttempts || 0) + 1,
      formalExamStartTime: toBeijingTime(new Date()).valueOf(),
      formalExamTimeLimit: 900
    };
    saveUserStatus(newStatus);
    
    message.success('正式考试开始！共20道题目（从40道题目中随机抽取），15分钟内完成，必须95分才能通过。');
  };

  // 完成正式考试
  const finishFormalExam = async () => {
    // 清除计时器
    if (examTimer) {
      clearInterval(examTimer);
      setExamTimer(null);
    }
    
    // 保存用户答案到本地存储
    localStorage.setItem('formal_exam_answers', JSON.stringify(userAnswers));
    
    let score = 0;
    const wrongQuestionsList: Question[] = [];
    
    formalExamQuestions.forEach(question => {
      const userAnswer = userAnswers[question.id];
      
      if (question.type === 'essay') {
        // 问答题：有答案就给满分，没有答案给0分
        if (userAnswer && userAnswer.trim().length > 0) {
          score += 5;
        } else {
          wrongQuestionsList.push(question);
        }
      } else if (question.type === 'fill') {
        // 填空题：严格匹配答案
        if (checkAnswer(question, userAnswer)) {
          score += 5;
        } else {
          wrongQuestionsList.push(question);
        }
      } else {
        // 单选题和多选题：严格匹配答案
        if (checkAnswer(question, userAnswer)) {
          score += 5;
        } else {
          wrongQuestionsList.push(question);
        }
      }
    });
    
    setFormalExamScore(score);
    setWrongQuestions(wrongQuestionsList);
    
    if (score >= 95) {
      // 自动分配用户到销售组
      try {
        const profileId = await getCurrentProfileId();
        if (profileId) {
          
          // 先获取销售组1的当前用户列表
          const { data: currentGroup, error: fetchError } = await supabase
            .from('users_list')
            .select('list')
            .eq('id', 1)
            .single();
          
          if (fetchError) {
            console.error('获取销售组信息失败:', fetchError);
            message.warning(`恭喜！正式考试通过！得分：${score}分，但销售组分配失败，请联系管理员。`);
            return;
          }
          
          // 检查用户是否已经在列表中
          const currentList = currentGroup.list || [];
          if (currentList.includes(profileId)) {
            message.success(`恭喜！正式考试通过！得分：${score}分，已自动加入销售组！`);
          } else {
            // 添加用户到销售组
            const newList = [...currentList, profileId];
            const { error: updateError } = await supabase
              .from('users_list')
              .update({ list: newList })
              .eq('id', 1)
              .select();
            
            if (updateError) {
              console.error('分配销售组失败:', updateError);
              message.warning(`恭喜！正式考试通过！得分：${score}分，但销售组分配失败，请联系管理员。`);
            } else {
              message.success(`恭喜！正式考试通过！得分：${score}分，已自动加入销售组！`);
            }
          }
        } else {
          console.error('无法获取用户profile ID');
          message.warning(`恭喜！正式考试通过！得分：${score}分，但销售组分配失败，请联系管理员。`);
        }
      } catch (error) {
        console.error('分配销售组异常:', error);
        message.warning(`恭喜！正式考试通过！得分：${score}分，但销售组分配失败，请联系管理员。`);
      }
      
      const newStatus: ExamStatus = {
        ...status!,
        status: 'completed' as const,
        formalExamScore: score,
        assignedSalesGroupId: 1 // 自动加入销售组id=1
      };
      saveUserStatus(newStatus);
      
      // 重新获取销售组信息
      await checkUserSalesGroup();
    } else {
      const newStatus: ExamStatus = {
        ...status!,
        status: 'exam_passed' as const,
        formalExamScore: score
      };
      saveUserStatus(newStatus);
      message.error(`考试未通过！得分：${score}分，需要95分才能通过。`);
    }
    
    setFormalExamMode(false);
    setFormalExamTimeLeft(900);
    setShowAnswers(false); // 退出正式考试模式，重置答案显示状态
    
    // 清理正式考试相关的状态
    setFormalExamQuestions([]);
    setSubmittedQuestions(new Set());
    setUserAnswers({});
    localStorage.removeItem('formal_exam_answers');
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 组件卸载时清理计时器
  useEffect(() => {
    return () => {
      if (examTimer) {
        clearInterval(examTimer);
      }
    };
  }, []); // 移除examTimer依赖，避免频繁重新创建清理函数

  // 监听页面失去焦点和刷新，自动结束考试
  useEffect(() => {
    if (!formalExamMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        message.error('页面失去焦点，考试自动结束！');
        finishFormalExam().catch(error => {
          console.error('页面失去焦点时提交考试失败:', error);
        });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formalExamMode) {
        e.preventDefault();
        e.returnValue = '考试进行中，关闭页面将自动结束考试！';
        return '考试进行中，关闭页面将自动结束考试！';
      }
    };

    const handlePageHide = () => {
      if (formalExamMode) {
        message.error('页面被关闭，考试自动结束！');
        finishFormalExam().catch(error => {
          console.error('页面关闭时提交考试失败:', error);
        });
      }
    };

    // 添加事件监听器
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // 清理函数
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [formalExamMode]); // 只依赖formalExamMode

  // status变化时自动同步currentStep - 使用useCallback优化
  const updateCurrentStep = useCallback(() => {
    if (!status) {
      setCurrentStep(0);
    } else if (status.status === 'completed' && status.assignedSalesGroupId) {
      setCurrentStep(2);
    } else if (status.status === 'formal_exam' || formalExamMode) {
      setCurrentStep(1);
    } else if (status.progressPercentage && status.progressPercentage === 100) {
      setCurrentStep(1);
    } else {
      setCurrentStep(0);
    }
  }, [status, formalExamMode]);

  useEffect(() => {
    updateCurrentStep();
  }, [updateCurrentStep]);

  // 当进入步骤3（加入销售组）时，确保获取销售组信息
  useEffect(() => {
    if (currentStep === 2 && status?.status === 'completed' && status?.assignedSalesGroupId) {
      // 如果还没有销售组信息，重新获取
      if (!salesGroupInfo) {
        checkUserSalesGroup().catch(error => {
          console.error('获取销售组信息失败:', error);
        });
      }
    }
  }, [currentStep, status, salesGroupInfo]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>;
  }


  const steps = [
    {
      title: '模拟考试',
      icon: <BookOutlined />,
      content: (
        <div>
          <div style={{ marginBottom: 0 }}>
            <Alert
              message={
                submittedQuestions.size === questions.length 
                  ? "模拟考试完成：恭喜！您已完成所有模拟题目，现在可以进入正式考试了。"
                  : "模拟考试：掌握新人期政策、积分规则、SOP执行要求。预估学习时间：约30分钟。"
              }
              type="success"
              showIcon
              style={{ marginBottom: 8 }}
              action={
                submittedQuestions.size === questions.length ? (
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => setCurrentStep(1)}
                  >
                    进入正式考试
                  </Button>
                ) : undefined
              }
            />
          <Progress 
              percent={Math.round((submittedQuestions.size / questions.length) * 100)} 
              status={submittedQuestions.size === questions.length ? 'success' : 'active'}
              format={percent => `${submittedQuestions.size}/${questions.length} (${percent}%)`}
              style={{ marginBottom: 8 }}
            />
          </div>

          <div className="exam-layout">
            {/* 左侧题目区域 */}
            <div className="exam-question-area">
              {questions[currentQuestionIndex] && renderQuestion(questions[currentQuestionIndex])}
            </div>
            
            {/* 右侧答案解析区域 */}
            <div className="exam-answer-area">
              {questions[currentQuestionIndex] && renderAnswerExplanation(questions[currentQuestionIndex])}
            </div>
          </div>
        </div>
      )
    },
    {
      title: '正式考试',
      icon: <FileTextOutlined />,
      content: (
        <div>
          {formalExamMode ? (
            // 正式考试进行中
            <div>
              <div style={{ marginBottom: 0 }}>
                <Card 
                  style={{ 
                    marginBottom: 16,
                    borderRadius: '8px',
                    border: '1px solid #ffd591',
                    backgroundColor: '#fff7e6'
                  }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {submittedQuestions.size === formalExamQuestions.length ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                      ) : (
                        <FileTextOutlined style={{ color: '#fa8c16', fontSize: '16px' }} />
                      )}
                      <span style={{ 
                        fontWeight: 500, 
                        color: submittedQuestions.size === formalExamQuestions.length ? '#52c41a' : '#fa8c16' 
                      }}>
                        {submittedQuestions.size === formalExamQuestions.length ? '考试完成，点击查看成绩' : '正式考试进行中'}
                      </span>
                    </div>
                    <div style={{ 
                      backgroundColor: submittedQuestions.size === formalExamQuestions.length ? '#52c41a' : '#fa8c16', 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: submittedQuestions.size === formalExamQuestions.length ? 'pointer' : 'default'
                    }}
                    onClick={submittedQuestions.size === formalExamQuestions.length ? finishFormalExam : undefined}
                    >
                      {submittedQuestions.size === formalExamQuestions.length ? '查看成绩' : `剩余时间：${formatTime(formalExamTimeLeft)}`}
                    </div>
                  </div>
                  <Progress 
                    percent={Math.round((submittedQuestions.size / formalExamQuestions.length) * 100)} 
                    status={submittedQuestions.size === formalExamQuestions.length ? 'success' : 'active'}
                    format={percent => `${submittedQuestions.size}/${formalExamQuestions.length} (${percent}%)`}
                    strokeColor={submittedQuestions.size === formalExamQuestions.length ? '#52c41a' : '#fa8c16'}
                  />
                  

                </Card>
                
                <Alert
                  message="考试安全提醒：请勿切换标签页、最小化窗口或关闭浏览器，否则考试将自动结束"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              </div>



              <div className="exam-layout">
                {/* 左侧题目区域 */}
                <div className="exam-question-area">
                  {formalExamQuestions[currentQuestionIndex] && renderQuestion(formalExamQuestions[currentQuestionIndex])}
                </div>
                
                {/* 右侧答案解析区域 */}
                <div className="exam-answer-area">
                  {formalExamQuestions[currentQuestionIndex] && renderAnswerExplanation(formalExamQuestions[currentQuestionIndex])}
                </div>
              </div>
            </div>
          ) : (
            // 正式考试开始界面或考试结果界面
            <div>
              {formalExamScore > 0 ? (
                // 考试结果界面
                <div style={{ padding: '20px' }}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <FileTextOutlined style={{ fontSize: 48, color: formalExamScore >= 95 ? '#52c41a' : '#ff4d4f', marginBottom: 16 }} />
                    <Title level={3} style={{ color: formalExamScore >= 95 ? '#52c41a' : '#ff4d4f' }}>
                      {formalExamScore >= 95 ? '考试通过！' : '考试未通过'}
                    </Title>
                    <Paragraph style={{ fontSize: '16px', marginBottom: 8 }}>
                      得分：<Text strong style={{ color: formalExamScore >= 95 ? '#52c41a' : '#ff4d4f' }}>
                        {formalExamScore}分
                      </Text> / 100分
                    </Paragraph>
                    <Paragraph style={{ color: '#666' }}>
                      {formalExamScore >= 95 ? '恭喜您通过了正式考试！' : '需要95分才能通过考试，请继续努力！'}
                    </Paragraph>
                  </div>

                  {wrongQuestions.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <Title level={4} style={{ marginBottom: 16 }}>
                        错题回顾 ({wrongQuestions.length}题)
                      </Title>
                      <Collapse>
                        {wrongQuestions.map((question, index) => {
                          const userAnswer = userAnswers[question.id];
                          const userAnswerDisplay = Array.isArray(userAnswer) ? userAnswer.join('、') : userAnswer;
                          
                          return (
                            <Panel 
                              key={question.id} 
                              header={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>第{index + 1}题：{question.title}</span>
                                  <Tag color="error">错误</Tag>
                                </div>
                              }
                            >
                              <div style={{ fontSize: '13px' }}>
                                <Paragraph>
                                  <Text strong>您的答案：</Text>
                                  <Text style={{ color: '#ff4d4f' }}>
                                    {userAnswerDisplay || '未作答'}
                                  </Text>
                                </Paragraph>
                                <Paragraph>
                                  <Text strong>正确答案：</Text>
                                  {Array.isArray(question.answer) ? question.answer.join('、') : question.answer}
                                </Paragraph>
                                <Paragraph>
                                  <Text strong>关键字：</Text>
                                  <Text code>{question.keywords}</Text>
                                </Paragraph>
                                <Paragraph>
                                  <Text strong>解析：</Text>
                                  {question.explanation}
                                </Paragraph>
                              </div>
                            </Panel>
                          );
                        })}
                      </Collapse>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <Space>
                      <Button 
                        type="primary" 
                        onClick={() => {
                          setFormalExamScore(0);
                          setWrongQuestions([]);
                          setUserAnswers({});
                        }}
                      >
                        重新考试
                      </Button>
                    </Space>
                  </div>
                </div>
              ) : (
                // 正式考试开始界面
                <div style={{ 
                  maxWidth: 600, 
                  margin: '0 auto',
                  padding: '24px'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '60px', 
                      borderRadius: '50%', 
                      backgroundColor: '#f0f8ff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      margin: '0 auto 16px'
                    }}>
                      <FileTextOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                    </div>
                    <Title level={3} style={{ marginBottom: '4px', color: '#262626' }}>
                      正式考试
                    </Title>
                    <Paragraph style={{ color: '#8c8c8c', fontSize: '13px', marginBottom: 0 }}>
                      完成模拟考试后，进入正式考试阶段
                    </Paragraph>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <Title level={5} style={{ marginBottom: '12px', color: '#262626' }}>
                      📋 考试规则
                    </Title>
                    <div style={{ 
                      backgroundColor: '#fafafa', 
                      padding: '16px', 
                      borderRadius: '6px',
                      border: '1px solid #f0f0f0'
                    }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '4px', 
                            height: '4px', 
                            borderRadius: '50%', 
                            backgroundColor: '#1890ff' 
                          }} />
                          <span style={{ fontSize: '13px', color: '#595959' }}>
                            从40道题目中随机抽取20道
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '4px', 
                            height: '4px', 
                            borderRadius: '50%', 
                            backgroundColor: '#1890ff' 
                          }} />
                          <span style={{ fontSize: '13px', color: '#595959' }}>
                            考试时间15分钟
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '4px', 
                            height: '4px', 
                            borderRadius: '50%', 
                            backgroundColor: '#1890ff' 
                          }} />
                          <span style={{ fontSize: '13px', color: '#595959' }}>
                            大于等于95分才能通过考试
                          </span>
                        </div>
                      </Space>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <Title level={5} style={{ marginBottom: '12px', color: '#262626' }}>
                      ⚠️ 重要提醒
                    </Title>
                    <div style={{ 
                      backgroundColor: '#fff7e6', 
                      padding: '12px', 
                      borderRadius: '6px',
                      border: '1px solid #ffd591'
                    }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ color: '#fa8c16', fontSize: '12px' }}>•</span>
                          <span style={{ fontSize: '13px', color: '#595959' }}>
                            考试开始后无法暂停，请确保有充足时间
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <span style={{ color: '#fa8c16', fontSize: '12px' }}>•</span>
                          <span style={{ fontSize: '13px', color: '#595959' }}>
                            考试过程中请勿切换页面或关闭浏览器，否则将自动结束考试
                          </span>
                        </div>
                      </Space>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <Button 
                      type="primary" 
                      size="large"
                      disabled={!status || (status.progressPercentage || 0) < 100}
                      onClick={startFormalExam}
                      style={{ 
                        height: '40px', 
                        padding: '0 24px',
                        fontSize: '14px',
                        borderRadius: '6px'
                      }}
                      icon={<FileTextOutlined />}
                    >
                      开始正式考试
                    </Button>
                    {(!status || (status.progressPercentage || 0) < 100) && (
                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          请先完成模拟考试
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      title: '加入销售组',
      icon: <TeamOutlined />,
      content: (
        <div style={{ 
          maxWidth: 800, 
          margin: '0 auto', 
          padding: '0px 0px',
          textAlign: 'center' 
        }}>
            {/* 单栏布局容器 */}
            <div style={{
              maxWidth: 600,
              margin: '0 auto',
              padding: '0 12px'
            }} className="success-content-container">
              {/* 恭喜文案 */}
              <div style={{
                textAlign: 'center',
                marginBottom: '24px',
              }}>
                <div style={{ 
                  fontSize: '24px', 
                  color: '#52c41a', 
                  marginBottom: '12px',
                  fontWeight: 600
                }}>
                  🎉 恭喜您加入销售组！
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#595959',
                  lineHeight: '1.5'
                }}>
                  您已成功通过新人培训考试，正式成为
                  <span style={{ 
                    color: '#52c41a', 
                    fontWeight: 600,
                    margin: '0 4px'
                  }}>
                    {salesGroupInfo?.groupname || '销售组 #1'}
                  </span>
                  的一员
                </div>
              </div>

              {/* Banner图片 */}
              <div style={{
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: '32px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/banners/banner/welcome.jpg`}
                  alt="欢迎加入销售组"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
              </div>

              {/* 操作指南 */}
              <Card
                style={{
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                title={
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '16px',
                    fontWeight: 600
                  }}>
                    <span style={{ fontSize: '18px' }}>💡</span>
                    接下来您可以
                  </div>
                }
                bodyStyle={{ padding: '16px' }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: '#e6f7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <span style={{ fontSize: '20px' }}>📋</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#262626', marginBottom: '4px' }}>
                        查看并跟进线索
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        及时处理新分配的客户线索，提高转化率
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: '#fff7e6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <span style={{ fontSize: '20px' }}>🎁</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#262626', marginBottom: '4px' }}>
                        完成更多任务
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        获得积分奖励，兑换更多优质线索
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: '#f6ffed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px'
                    }}>
                      <span style={{ fontSize: '20px' }}>🏆</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#262626', marginBottom: '4px' }}>
                        查看成交数据
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        分析销售漏斗，提升销售业绩
                      </div>
                    </div>
                  </div>
                </Space>
              </Card>
            </div>


        </div>
      )
    }
  ];

  // 步骤切换时，更新currentStep，只有允许的步骤可切换
  const handleStepChange = (step: number) => {
    // 正式考试进行中时，不允许切换标签页
    if (formalExamMode) {
      return;
    }
    
    if (step === 0) {
      setCurrentStep(0);
    } else if (step === 1 && (status?.progressPercentage || 0) >= 100) {
      setCurrentStep(1);
    } else if (step === 2 && status?.status === 'completed' && status?.assignedSalesGroupId) {
      setCurrentStep(2);
    }
  };

  return (
    <>
      <style>{`
        /* 新手入门页面响应式样式 */
        .onboarding-container {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .onboarding-layout {
          display: flex;
          gap: 24px;
        }
        
        .onboarding-sidebar {
          width: 200px;
          flex-shrink: 0;
        }
        
        .onboarding-content {
          flex: 1;
        }
        
        .exam-layout {
          display: flex;
          gap: 24px;
          height: 60vh;
          margin-top: 0;
        }
        
        .exam-question-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        
        .exam-answer-area {
          flex: 1;
          min-width: 0;
        }
        
        /* 考试区域卡片统一样式 */
        .exam-question-area .ant-card,
        .exam-answer-area .ant-card {
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
          border: 1px solid #f0f0f0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        .exam-question-area .ant-card .ant-card-head,
        .exam-answer-area .ant-card .ant-card-head {
          border-bottom: 1px solid #f0f0f0 !important;
          padding: 16px 24px !important;
          min-height: 60px !important;
        }
        
        .exam-question-area .ant-card .ant-card-body,
        .exam-answer-area .ant-card .ant-card-body {
          padding: 24px !important;
        }
        
        /* 题型标签样式优化 */
        .exam-question-area .ant-card .ant-card-head .ant-card-extra {
          margin-right: -8px !important;
        }
        
        .exam-question-area .ant-card .ant-card-head .ant-card-extra .ant-tag {
          margin-right: 0 !important;
          border-radius: 4px !important;
        }
        
        /* 小屏幕响应式布局 */
        @media (max-width: 768px) {
          .onboarding-container {
            padding: 4px 4px;
          }
          
          .onboarding-layout {
            flex-direction: column;
            gap: 12px;
          }
          
          .onboarding-sidebar {
            width: 100%;
            order: 1;
          }
          
          .onboarding-content {
            order: 2;
          }
          
          .exam-layout {
            flex-direction: column;
            height: auto;
            gap: 16px;
          }
          
          .exam-question-area,
          .exam-answer-area {
            min-height: 300px;
          }
          
          /* 步骤条在小屏幕上强制横向显示 */
          .onboarding-sidebar .onboarding-steps.ant-steps {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item {
            flex: 1 !important;
            margin: 0 !important;
            padding: 0 4px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item .ant-steps-item-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item .ant-steps-item-content {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            margin-top: 2px !important;
            min-height: auto !important;
            height: auto !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item .ant-steps-item-title {
            font-size: 11px !important;
            text-align: center !important;
            margin-top: 2px !important;
            margin-bottom: 0 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 100% !important;
            line-height: 1.1 !important;
            width: 100% !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item .ant-steps-item-icon {
            margin-right: 0 !important;
            margin-bottom: 2px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          /* 完全隐藏步骤连接线 */
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item .ant-steps-item-tail {
            display: none !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item::after {
            display: none !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item:not(:last-child)::after {
            display: none !important;
          }
          
          /* 步骤条标题简化 */
          .onboarding-sidebar .ant-card .ant-card-head-title {
            font-size: 14px !important;
            text-align: center !important;
          }
          
          /* 隐藏小屏幕端的新手入门标题 */
          .onboarding-sidebar .ant-card .ant-card-head {
            display: none !important;
          }
          
          /* 大幅减少步骤条卡片的内边距 */
          .onboarding-sidebar .ant-card .ant-card-body {
            padding: 4px !important;
          }
          
          .onboarding-sidebar .ant-card .ant-card-head {
            padding: 0 8px !important;
            min-height: 40px !important;
          }
          
          /* 强制移除步骤条的所有默认边距 */
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .onboarding-sidebar .onboarding-steps.ant-steps .ant-steps-item-container .ant-steps-item-content {
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          
          /* 非常小屏幕的优化 */
          @media (max-width: 375px) {
            .onboarding-sidebar .ant-steps .ant-steps-item .ant-steps-item-title {
              font-size: 10px !important;
            }
            
            .onboarding-sidebar .ant-steps .ant-steps-item {
              padding: 0 2px !important;
            }
          }
          
          /* 移动端优化考试界面底部按钮 */
          .exam-question-area .ant-card .ant-card-body {
            padding-bottom: 120px !important;
          }
          
          /* 移动端题目导航按钮优化 */
          .exam-question-area .ant-btn {
            font-size: 14px !important;
            padding: 8px 16px !important;
            height: auto !important;
            min-height: 40px !important;
          }
          
          /* 移动端卡片标题优化 */
          .onboarding-content .ant-card .ant-card-head-title {
            font-size: 16px !important;
          }
          
          /* 移动端答案解析区域优化 */
          .exam-answer-area .ant-card .ant-card-body {
            padding: 12px !important;
            font-size: 14px !important;
          }
          
          /* 移动端主要内容卡片优化 */
          .onboarding-content .ant-card .ant-card-body {
            padding: 8px !important;
          }
          
          /* 移动端考试题目卡片优化 */
          .exam-question-area .ant-card .ant-card-body {
            padding: 12px !important;
            padding-bottom: 100px !important;
          }
          
          /* 移动端加入销售组阶段卡片优化 */
          .onboarding-content .ant-card .ant-card-body .ant-card {
            margin: 0 !important;
            border-radius: 8px !important;
          }
          
          .onboarding-content .ant-card .ant-card-body .ant-card .ant-card-body {
            padding: 12px !important;
          }
          
          /* 移动端操作指南卡片间距优化 */
          .onboarding-content .ant-card .ant-card-body .ant-card .ant-card-body .ant-space-item {
            margin-bottom: 8px !important;
          }
          
          .onboarding-content .ant-card .ant-card-body .ant-card .ant-card-body .ant-space-item .ant-card {
            margin: 0 !important;
            border-radius: 6px !important;
          }
          
          /* 移动端成功页面内容容器优化 */
          .success-content-container {
            padding: 0 4px !important;
          }
          
          /* 移动端指南卡片内边距优化 */
          .success-content-container .ant-card .ant-card-body {
            padding: 8px !important;
          }
          
          /* 移动端题型标签优化 */
          .exam-question-area .ant-card .ant-card-head .ant-card-extra {
            margin-right: -4px !important;
          }
          
          .exam-question-area .ant-card .ant-card-head .ant-card-extra .ant-tag {
            font-size: 11px !important;
            padding: 2px 6px !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>
      <div className="onboarding-container">
        <div className="onboarding-layout">
          {/* 左侧步骤条 */}
          <div className="onboarding-sidebar">
            <Card title="新手入门" style={{ height: 'fit-content' }}>
              <Steps
                direction="vertical"
                size="small"
                current={currentStep}
                onChange={handleStepChange}
                className="onboarding-steps"
                items={[
                  {
                    title: '模拟考试',
                    disabled: formalExamMode
                  },
                  {
                    title: '正式考试',
                    disabled: (submittedQuestions.size || 0) < questions.length && !formalExamMode
                  },
                  {
                    title: '加入销售组',
                    disabled: status?.status !== 'completed' || !status?.assignedSalesGroupId
                  }
                ]}
              />
            </Card>
          </div>

          {/* 右侧内容区域 */}
          <div className="onboarding-content">
            <Card>
              {steps[currentStep].content}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingPage; 