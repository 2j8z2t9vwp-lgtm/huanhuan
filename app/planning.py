"""Editable restaurant planning tools. Template output is never labeled video understanding."""
import json
import re

ANGLES = [
    ('菜品诱惑', '先给成品，再给做法', '成品近景 → 关键工序 → 一口反馈 → 到店信息'),
    ('老板出镜', '用一个具体问题开场', '顾客疑问 → 老板回答 → 后厨实证 → 邀请提问'),
    ('价格价值', '把一份餐的内容摆清楚', '整桌俯拍 → 逐项展示 → 份量参照 → 价格条件'),
    ('后厨信任', '让顾客看见平时看不到的', '顾客顾虑 → 实际操作 → 细节特写 → 当天出品'),
    ('同城场景', '把菜放进真实吃饭场景', '谁在什么地方吃 → 适配菜品 → 用餐体验 → 位置指引'),
    ('顾客问答', '一次只回答一个到店问题', '真实问题 → 实拍回答 → 条件说明 → 下个问题'),
    ('门店日常', '记录一件今天发生的小事', '当日事件 → 人物动作 → 出品结果 → 当天营业信息'),
    ('第一视角Vlog', '以真实员工视角记录一段工作', '我开始做什么 → 手上动作 → 当下小细节 → 阶段结果'),
    ('店员跟拍', '跟着一位店员完成一件事', '人物任务 → 跟拍行动 → 工作细节 → 完成任务'),
    ('吃法攻略', '教会第一次来的顾客怎么吃', '一个吃法问题 → 实物示范 → 搭配选择 → 实用结论'),
    ('菜品对比', '把两个真实选择放在一起', '两款同框 → 相同标准对照 → 各自适合谁 → 自己选择'),
    ('新品介绍', '只讲新品带来的一个变化', '新品亮相 → 变化细节 → 实际出品 → 供应条件'),
    ('午休用餐', '记录真实的一次工作餐流程', '午休需求 → 到店点餐 → 实际等待与用餐 → 位置提醒'),
    ('声音特写', '用真实操作声串起出品', '一个动作声 → 连续操作 → 近景细节 → 成品收尾'),
]

def rule_report(transcript, frames, meta):
    text = transcript.strip()
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    # Only report quoted text; the first available transcript line may be later than 0s.
    evidence = []
    if text:
        evidence.append({'time': '转写首句（以时间戳为准）', 'observation': lines[0][:220], 'meaning': '这是提取到的语音文本，请先对照原视频校正。'})
    structure = []
    timed = []
    for line in lines:
        match = re.match(r'\[([\d.]+)s[–-]([\d.]+)s\]\s*(.*)', line)
        if match:
            start, end, words = match.groups()
            timed.append((float(start), float(end), words))
    duration = float(meta.get('duration') or (timed[-1][1] if timed else 0))
    if timed:
        evidence = []
        for label, pattern in [('价格与优惠线索', r'\d+\s*(?:元|块|折)|价格|优惠|套餐|人均'), ('菜品与工艺线索', r'现炒|现做|现煮|手工|牛肉|火锅|面|汤|肉|烤|炒|煮|炸|蒸'), ('到店与行动线索', r'地址|路口|地铁|附近|位于|营业|过来|来店|收藏|评论|团购|留言')]:
            selected = next((s for s in timed if re.search(pattern, s[2])), None)
            if selected:
                start, end, words = selected
                evidence.append({'time': f'{start:.1f}–{end:.1f}s', 'observation': words, 'meaning': label + '（按转写关键词匹配，未核验事实）'})
        if not evidence:
            evidence = [{'time': f'{s[0]:.1f}–{s[1]:.1f}s', 'observation': s[2], 'meaning': '原片语音节选，请核对识别结果。'} for s in timed[:3]]
        for title, selected in [('开头语音', [s for s in timed if s[0] < 3]), ('中段语音', [s for s in timed if s[0] >= 3 and s[0] < max(3, duration - 5)]), ('末段语音', [s for s in timed if s[0] >= max(3, duration - 5)])]:
            if selected:
                structure.append({'time': f'{selected[0][0]:.1f}–{selected[-1][1]:.1f}s', 'content': ' / '.join(s[2] for s in selected)[:500], 'function': title + ' · 仅按时间分组，段落作用需结合画面判断'})
    return {
        'mode': 'local', 'summary': f'已提取 {len(frames)} 个关键帧' + (f'、{len(timed)} 段语音，并按时间和关键词整理内容线索。' if timed else '；暂无可整理的带时间语音。') + '当前未进行画面语义理解，不能据此判定爆款成因。',
        'hook': {'quote': lines[0][:180] if lines else '', 'mechanism': '待确认：请播放前 3 秒，记录第一句话、第一画面和观众继续看的理由。'},
        'evidence': evidence,
        'structure': structure,
        'transfer': ['借用开场问题与信息顺序，用自己的菜品、店员和实拍素材重做。', '先填写门店档案，再生成拍摄脚本；价格和优惠一律按实际确认。'],
        'unknowns': ['未自动理解画面、音乐和人物情绪', '没有原视频后台的留存／转化数据，无法确认走红原因', '自动语音转写可能有错字，脚本引用前须核对'],
        'review_prompts': ['0–3 秒：是成品、人物、价格，还是一个问题？', '中段：哪些画面证明了开头的承诺？', '结尾：让观众收藏、提问、到店，还是购买？'],
    }

def make_script(profile, video=None, angle='菜品诱惑', note=''):
    name = profile.get('name') or '【门店名】'
    city = profile.get('city') or '【城市／商圈】'
    dish = profile.get('dish') or '【主推菜】'
    audience = profile.get('audience') or '附近想找一顿好饭的顾客'
    price = profile.get('price') or '【实际价格，拍前确认】'
    advantage = profile.get('advantage') or '【填写一个能实拍证明的卖点】'
    mode = next((a for a in ANGLES if a[0] == angle), ANGLES[0])
    hooks = {
        '菜品诱惑': f'在{city}，想吃{dish}的先看看这一份。',
        '老板出镜': f'来店里，大家最常问我的一个问题是：【真实顾客问题】。',
        '价格价值': f'{dish}这一份到底有什么？今天摆开给你看。',
        '后厨信任': f'这份{dish}上桌之前，后厨在忙什么？',
        '同城场景': f'在{city}，今天【用餐场景】可以吃点什么？',
        '顾客问答': f'来{ name }之前，你是不是也想问：【顾客问题】？',
        '门店日常': f'今天店里【一件真实发生的小事】，我拍给你看。',
        '第一视角Vlog': f'今天跟着我，在{name}做一份{dish}。',
        '店员跟拍': '跟着【店员称呼】，看看今天这件事怎么完成。',
        '吃法攻略': f'第一次吃{dish}，这一步可以怎么做？',
        '菜品对比': f'{dish}和【另一款实际菜品】，你会怎么选？',
        '新品介绍': '今天拍近一点，看看【实际新品】变在哪里。',
        '午休用餐': f'午休来{name}吃饭，实际是什么流程？',
        '声音特写': '',
    }
    shots = [
        {'time': '0–3s', 'visual': '成品或关键人物先入画；一镜表达一个信息', 'voice': hooks.get(angle, hooks['菜品诱惑']), 'subtitle': f'{city} · {dish}', 'props': f'{dish}成品、干净桌面'},
        {'time': '3–10s', 'visual': '近景拍最能证明卖点的操作，保留锅气／切菜声', 'voice': f'我们这份{dish}，你可以看这里：{advantage}。', 'subtitle': advantage, 'props': '备料、厨师操作；确认可拍摄'},
        {'time': '10–20s', 'visual': '完整展示份量与搭配；需要时放餐具做尺度参照', 'voice': f'这一份是{price}，包含【实际内容】。适合【实际人数／场景】。', 'subtitle': '价格、份量、适用条件按实际填写', 'props': '整份菜、菜单、搭配餐具'},
        {'time': '20–28s', 'visual': '店员／老板真实试吃或补充一个实用信息', 'voice': '【描述真实口感或回答一个到店问题，避免空泛夸赞】。', 'subtitle': '一个具体的口感／到店信息', 'props': '出镜人、领夹麦（可选）'},
        {'time': '28–35s', 'visual': '门头与入口，给出可识别的位置参照', 'voice': f'我们是{name}，在{city}{profile.get("location") or "【具体位置】"}。想知道【一个实际问题】，可以留言。', 'subtitle': f'{name}｜具体地址与营业时间', 'props': '门头、路线、当天营业信息'},
    ]
    if angle in ('老板出镜', '顾客问答'):
        shots[1]['voice'] = '【用一句日常说话的方式回答刚才的问题】。'
        shots[2]['voice'] = '【给出一项能现场验证的事实：菜单、份量、操作或时间】。'
    if angle == '老板出镜':
        shots[0]['visual'] = '老板在店内看镜头，直接提出真实问题，不先做自我介绍'
        shots[1]['visual'] = '老板边操作边回答；用中景交代人与厨房的关系'
        shots[2]['visual'] = '切到能证明回答的特写，不用空镜头遮盖信息'
        shots[3]['visual'] = '回到老板脸部，补充一个需要说明的限制条件'
        shots[3]['voice'] = '【补充一个实际条件，例如需要等多久、什么时间有供应】。'
        shots[4]['voice'] = f'我是{name}的【姓名／称呼】。还想看店里的什么，留言告诉我。'
    elif angle == '价格价值':
        shots[0]['visual'] = '整份餐俯拍一次给全，菜单或价签与餐品一起入画'
        shots[1]['visual'] = '逐样把这份餐的实际内容放到桌面，每样停留一秒'
        shots[1]['voice'] = '这一份里有【实际主菜】、【实际配菜】和【实际搭配】，都摆在这里。'
        shots[2]['visual'] = '用常见餐具和完整餐盘展示份量，避免只拍超近特写'
        shots[2]['voice'] = f'这一份{price}。份量和搭配你可以对着桌上的实物看。'
        shots[3]['visual'] = '菜单细节：把人数、时段、是否另收费等条件拍清楚'
        shots[3]['voice'] = '点餐前还要注意：【实际适用条件／是否有额外收费，没有就如实说明】。'
    elif angle == '后厨信任':
        shots[0]['visual'] = '从后厨开始，先给一个与顾客顾虑有关的具体操作'
        shots[1]['visual'] = '记录原料处理的真实步骤，保持镜头连续，不用库存素材'
        shots[1]['voice'] = f'这是今天做{dish}的【实际备料步骤】，你看【能被镜头验证的细节】。'
        shots[2]['visual'] = '拍出从下锅到装盘的关键动作，保留操作声'
        shots[2]['voice'] = f'{advantage}。这里再给你看近一点。'
        shots[3]['visual'] = '同一份菜从出锅到传菜口，保持前后能对上'
        shots[3]['voice'] = '这份做好后，就从这里送到桌上。还有哪一步想看，我下次接着拍。'
    elif angle == '同城场景':
        shots[0]['visual'] = '用真实商圈地标／店外环境建立位置，马上接用餐场景'
        shots[1]['visual'] = '出镜人或店员演示真实点餐过程，不冒充顾客评价'
        shots[1]['voice'] = f'如果你是{audience}，可以看看我们店的{dish}。'
        shots[2]['visual'] = '展示座位、实际份量和用餐状态，说明适合什么场景'
        shots[2]['voice'] = f'这份是{price}。这里的【座位／打包／等餐条件】是【实际情况】。'
        shots[3]['visual'] = '从路口或最近参照物连贯拍到门头'
        shots[3]['voice'] = f'到店可以认这个【真实参照物】。具体位置在{profile.get("location") or "【补充地址】"}。'
    elif angle == '顾客问答':
        shots[0]['visual'] = '字幕先打出一个真实常见问题；出镜人直接回应'
        shots[1]['visual'] = '用实拍回答问题；停车拍入口，份量拍整盘，等餐拍实际情况'
        shots[2]['visual'] = '如果问题存在条件差异，把两种情况分别拍清楚'
        shots[2]['voice'] = '不过要分情况：【实际情况一】；如果是【情况二】，就要【实际处理方式】。'
        shots[3]['visual'] = '把结论和条件做成一张可读字幕，配合真实场景'
        shots[3]['voice'] = '所以来之前，记住【一句准确的答复】就行。'
    elif angle == '门店日常':
        shots[0]['visual'] = '当天事件直接开场：备菜、到货、忙中一个小插曲，避免先拍空门头'
        shots[1]['visual'] = '跟拍参与事件的人做具体动作，说明这件事为何发生'
        shots[1]['voice'] = '刚才【实际发生的事情】，所以我们现在在【真实处理动作】。'
        shots[2]['visual'] = '拍一个真实细节：手上动作、桌面变化或一份餐的制作过程'
        shots[2]['voice'] = '【用一句话说清今天这个细节，不虚构戏剧冲突】。'
        shots[3]['visual'] = '事件有了结果就记录结果；没有结果就停在眼前进度'
        shots[3]['voice'] = '现在【真实进展】。我们接着忙，今天【核实后的营业信息】。'
    elif angle in ('第一视角Vlog', '店员跟拍', '吃法攻略', '菜品对比', '新品介绍', '午休用餐', '声音特写'):
        designs = {
            '第一视角Vlog': [
                ('本人胸前或手持第一视角，手伸向实际工作物件', hooks[angle], '店员第一视角'),
                ('第一视角记录一个连续操作，避免切成第三方探店', '我现在在【真实正在做的事】。', '跟着手上的动作看'),
                ('凑近拍本人注意到的一个真实小细节', '这里【一个实际细节】，拍近一点给你看。', '今天的小细节'),
                ('回到本人手部，继续同一件事并拍到阶段结果', '做到这里，【当前真实进度】。', '不虚构当天事件'),
                ('第一视角放下成品或收好工作物件，留一秒环境声', f'这段先记到这里，我接着忙。', name)],
            '店员跟拍': [
                ('中景交代店员和本次任务，出镜人同意拍摄', hooks[angle], '今天跟拍一件事'),
                ('侧后方跟随店员走向任务现场', '店员：【我现在要完成的真实任务】。', '跟随行动'),
                ('切手部特写，记录任务中最具体的一步', '店员：【用日常话解释这一步】。', '工作细节'),
                ('中景记录任务完成或实际卡在什么进度', '店员：【当前结果，不安排假冲突】。', '任务进展'),
                ('店员回到岗位，镜头自然结束', '', name)],
            '吃法攻略': [
                ('成品与餐具同框，用动作提出一个真实吃法问题', hooks[angle], '第一次来怎么吃'),
                ('完整演示一个适合自家出品的吃法动作', '先【实际可操作的吃法】。', '第一步'),
                ('展示一种菜单上真实存在的搭配', '想搭配的话，可以选【实际搭配】。', '按个人口味选择'),
                ('拍不同偏好对应的两种实际选择', '如果你更喜欢【偏好】，可以【真实选择】。', '不用说唯一正确吃法'),
                ('成品与吃法字幕同时出现', '这次先试这一种，下次再换个搭配。', name)],
            '菜品对比': [
                ('两款实际菜品同桌同景别展示，不刻意制造份量差异', hooks[angle], '两种选择摆一起'),
                ('相同光线下分别近拍两款菜的可见差异', '这边是【实际差异一】，那边是【实际差异二】。', '看清实际差别'),
                ('展示菜单中的规格或配料，用同一标准比较', '再看【同一比较标准】。', '同标准对照'),
                ('各拍一镜适用场景，明确属于选择建议', '想要【需求一】可以选这份；偏向【需求二】再看那份。', '按自己的需求选'),
                ('两款重新同框，不宣布虚构销量或排名', '你更想先试哪一份？', name)],
            '新品介绍': [
                ('拍已确认可以公开的真实新品，直接展示外观', hooks[angle], '【实际新品名称】'),
                ('近拍新品的一项真实变化', '这次变化在【已核实的变化】。', '只讲一个变化'),
                ('拍店内实际制作过程，不加入未确认配方', '【简短说明实际制作动作】。', '以实际出品为准'),
                ('将真实出品完整摆出，按本人实际试吃反馈填写', '【本人实际试吃后的一句具体描述】。', '口感由本人核实'),
                ('以清楚的菜单或供应信息收尾', '【核实后的供应门店、时间与条件】。', name)],
            '午休用餐': [
                ('真实午休时段，在门店入口开始记录，不假扮顾客体验', hooks[angle], '实际午餐流程'),
                ('拍点餐区域与实际可选餐品', '今天可以选【真实供应的菜品】。', '当天实际供应'),
                ('记录一单经允许拍摄的真实出餐过程，计时须真实', '【实际等待情况；没有计时就不报分钟数】。', '不承诺固定出餐速度'),
                ('拍上桌后的完整餐品与用餐环境，避开未授权顾客面部', '这一餐是【实际点单内容】。', '一顿工作餐'),
                ('门头和清楚的位置参照', f'我们在{city}【实际商圈与位置】。', name)],
            '声音特写': [
                ('收近一个真实操作声并同步拍手部动作，停留不说话', '', '【实际菜名】'),
                ('连续记录下一步操作，保留同期声，不配虚假声音冒充实录', '', ''),
                ('近拍与声音对应的可见细节，让动作完整发生', '', ''),
                ('记录真实装盘或上桌声，避免用餐具敲击夸张造声', '', ''),
                ('成品定格，留真实环境声，只放店名字幕', '', name)],
        }
        shots = [{'time': t, 'visual': v, 'voice': voice, 'subtitle': sub, 'props': f'自家真实出品、手机与收音；{mode[1]}'} for t, (v, voice, sub) in zip(('0–3s','3–9s','9–16s','16–23s','23–28s'), designs[angle])]
    report = (video or {}).get('report') or {}
    return {
        'title': f'{dish}｜{angle}·待拍脚本', 'angle': angle, 'status': 'draft',
        'origin': 'template', 'basis': '餐饮策划模板；请填写占位内容。这不是原视频的自动仿写。',
        'profile_id': profile.get('id'), 'profile_snapshot': profile,
        'source_id': (video or {}).get('id'), 'source_title': (video or {}).get('title', ''),
        'goal': f'让{audience}看清{dish}的真实卖点，并知道如何到店',
        'hook': hooks.get(angle, hooks['菜品诱惑']), 'shots': shots,
        'titles': [f'{city}，这一份{dish}给你看清楚', f'来{name}之前，先看这份{dish}', f'{dish}怎么选？把份量和搭配摆开说'],
        'caption': f'{city}的朋友，今天拍了{name}的{dish}。具体价格、份量和营业信息以门店当日公示为准。',
        'tags': [f'#{city}', f'#{profile.get("category") or "本地美食"}', f'#{dish}'],
        'cover': f'{dish}\n一份有什么',
        'checklist': ['替换所有【占位内容】并核实价格', '竖屏拍摄，擦镜头，食物亮度正常', '先拍 2 个不同开场，主体内容保持一致', '台词与实际出品一致，收音可听清', '发布前确认门店定位、营业时间及团购条件'],
        'publish_checks': [], 'notes': note, 'source_notes': (video or {}).get('notes', ''),
        'source_hook': report.get('hook', {}).get('quote', ''), 'scheduled_date': '',
        'metrics': {},
    }

def make_subject_script(subject, video=None, angle='菜品诱惑', note=''):
    """Profile-free starting outline; no store facts or default price segments."""
    mode = next((a for a in ANGLES if a[0] == angle), ANGLES[0])
    beats = [x.strip() for x in mode[2].split('→')]
    return {
        'title': f'{subject}｜{angle}·内容提纲', 'angle': angle, 'status': 'draft',
        'origin': 'template', 'basis': '仅为本次主题的拍摄提纲；未进行 AI 骨架迁移。',
        'profile_id': None, 'profile_snapshot': {}, 'target_subject': subject,
        'source_id': (video or {}).get('id'), 'source_title': (video or {}).get('title',''),
        'goal': f'围绕“{subject}”组织一条可拍内容。', 'hook': '',
        'shots': [{'time': t, 'visual': f'{subject}：{b}，以实际可拍内容填写。', 'voice': '', 'subtitle': '', 'props': '按本次拍摄安排准备'} for t,b in zip(('0–3s','3–10s','10–18s','18–24s'), beats)],
        'titles': [], 'caption': '', 'tags': [], 'cover': '',
        'checklist': ['对照本次主题填写动作和对白', '只使用本次提供的事实，不从旧门店档案补价格或地址'],
        'publish_checks': [], 'notes': note, 'source_notes': (video or {}).get('notes',''),
        'source_hook': ((video or {}).get('report') or {}).get('hook',{}).get('quote',''),
        'scheduled_date': '', 'metrics': {},
    }

def review(script):
    m = script.get('metrics') or {}
    views = float(m.get('views') or 0)
    rates = {k: round(float(m.get(k) or 0) / views * 100, 2) if views else None for k in ('likes', 'comments', 'favorites', 'profile_visits', 'orders')}
    tips = []
    if not views:
        tips.append('先记录同一观察窗口（例如发布后 24 小时）的播放量与互动数据，再进行比较。')
    if views:
        tips.append('这些是该条内容的实际比率，没有用固定的“及格线”判断流量。优先与同门店、相近时长、相同观察窗口的内容比较。')
    if not m.get('completion'):
        tips.append('补充完播率和平均观看时长，区分开场吸引力与中段信息密度。')
    tips.append('下一条只改变一个变量：开头第一画面或第一句台词。到店咨询／订单是餐饮账号更接近生意的结果。')
    return {'rates': rates, 'tips': tips}

def markdown(script):
    rows = [f'# {script["title"]}', '', script.get('basis', ''), '', f'目标：{script.get("goal", "")}', '']
    performance = script.get('performance')
    if performance:
        rows += ['## 剧情演绎', performance['premise'], '']
        rows += [f'- {c["role"]}：{c["objective"]}' for c in performance['cast']]
        rows += ['情境：' + performance['tension'], '变化：' + performance['turn'], '收尾：' + performance['ending'], '']
    blueprint = script.get('reference_blueprint')
    if blueprint:
        rows += ['## 参考骨架与迁移', blueprint['mechanism'], '反事实检查：' + blueprint['counterfactual'], '']
        for b in blueprint['beats']:
            rows += [f'### {b["start"]}–{b["end"]}秒｜{b["function"]}', '原片：' + b['source'], '证据：' + b['evidence'], '自家：' + b['target'], '']
        rows += ['证据边界：' + '；'.join(blueprint['limits']), '']
    rows += ['## 拍摄脚本', '']
    for s in script.get('shots', []):
        rows += [f'### {s.get("time", "")}', f'画面：{s.get("visual", "")}', f'口播：{s.get("voice", "")}', f'字幕：{s.get("subtitle", "")}', f'准备：{s.get("props", "")}', '']
    rows += ['## 发布文案', script.get('caption', ''), ' '.join(script.get('tags', [])), '', '## 拍摄检查']
    rows += ['- [ ] ' + x for x in script.get('checklist', [])]
    rows += ['', '## 备注', script.get('notes', '')]
    return '\n'.join(rows)
